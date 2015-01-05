/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

//! The task that handles all painting.

use buffer_map::BufferMap;
use display_list::{mod, StackingContext};
use font_cache_task::FontCacheTask;
use font_context::FontContext;
use paint_context::PaintContext;

use azure::azure_hl::{SurfaceFormat, Color, DrawTarget, BackendType, StolenGLResources};
use azure::AzFloat;
use geom::matrix2d::Matrix2D;
use geom::point::Point2D;
use geom::rect::Rect;
use geom::size::Size2D;
use layers::platform::surface::{NativeGraphicsMetadata, NativePaintingGraphicsContext};
use layers::platform::surface::{NativeSurface, NativeSurfaceMethods};
use layers::layers::{BufferRequest, LayerBuffer, LayerBufferSet};
use layers;
use servo_msg::compositor_msg::{Epoch, PaintState, LayerId};
use servo_msg::compositor_msg::{LayerMetadata, PaintListener, ScrollPolicy};
use servo_msg::constellation_msg::Msg as ConstellationMsg;
use servo_msg::constellation_msg::{ConstellationChan, Failure, PipelineId};
use servo_msg::constellation_msg::PipelineExitType;
use servo_msg::platform::surface::NativeSurfaceAzureMethods;
use servo_util::geometry::{Au, ZERO_POINT};
use servo_util::opts;
use servo_util::smallvec::SmallVec;
use servo_util::task::spawn_named_with_send_on_failure;
use servo_util::task_state;
use servo_util::time::{TimeProfilerChan, TimeProfilerCategory, profile};
use std::comm::{Receiver, Sender, channel};
use std::mem;
use std::task::TaskBuilder;
use sync::Arc;

/// Information about a hardware graphics layer that layout sends to the painting task.
#[deriving(Clone)]
pub struct PaintLayer {
    /// A per-pipeline ID describing this layer that should be stable across reflows.
    pub id: LayerId,
    /// The color of the background in this layer. Used for unpainted content.
    pub background_color: Color,
    /// The scrolling policy of this layer.
    pub scroll_policy: ScrollPolicy,
}

impl PaintLayer {
    /// Creates a new `PaintLayer`.
    pub fn new(id: LayerId, background_color: Color, scroll_policy: ScrollPolicy) -> PaintLayer {
        PaintLayer {
            id: id,
            background_color: background_color,
            scroll_policy: scroll_policy,
        }
    }
}

pub struct PaintRequest {
    pub buffer_requests: Vec<BufferRequest>,
    pub scale: f32,
    pub layer_id: LayerId,
    pub epoch: Epoch,
}

pub enum Msg {
    PaintInit(Arc<StackingContext>),
    Paint(Vec<PaintRequest>),
    UnusedBuffer(Vec<Box<LayerBuffer>>),
    PaintPermissionGranted,
    PaintPermissionRevoked,
    Exit(Option<Sender<()>>, PipelineExitType),
}

#[deriving(Clone)]
pub struct PaintChan(Sender<Msg>);

impl PaintChan {
    pub fn new() -> (Receiver<Msg>, PaintChan) {
        let (chan, port) = channel();
        (port, PaintChan(chan))
    }

    pub fn send(&self, msg: Msg) {
        let &PaintChan(ref chan) = self;
        assert!(chan.send_opt(msg).is_ok(), "PaintChan.send: paint port closed")
    }

    pub fn send_opt(&self, msg: Msg) -> Result<(), Msg> {
        let &PaintChan(ref chan) = self;
        chan.send_opt(msg)
    }
}

pub struct PaintTask<C> {
    id: PipelineId,
    port: Receiver<Msg>,
    compositor: C,
    constellation_chan: ConstellationChan,

    /// A channel to the time profiler.
    time_profiler_chan: TimeProfilerChan,

    /// The native graphics context.
    native_graphics_context: Option<NativePaintingGraphicsContext>,

    /// The root stacking context sent to us by the layout thread.
    root_stacking_context: Option<Arc<StackingContext>>,

    /// Permission to send paint messages to the compositor
    paint_permission: bool,

    /// A counter for epoch messages
    epoch: Epoch,

    /// A data structure to store unused LayerBuffers
    buffer_map: BufferMap,

    /// Communication handles to each of the worker threads.
    worker_threads: Vec<WorkerThreadProxy>,

    /// Tracks the number of buffers that the compositor currently owns. The
    /// PaintTask waits to exit until all buffers are returned.
    used_buffer_count: uint,
}

// If we implement this as a function, we get borrowck errors from borrowing
// the whole PaintTask struct.
macro_rules! native_graphics_context(
    ($task:expr) => (
        $task.native_graphics_context.as_ref().expect("Need a graphics context to do painting")
    )
)

fn initialize_layers<C>(compositor: &mut C,
                        pipeline_id: PipelineId,
                        epoch: Epoch,
                        root_stacking_context: &StackingContext)
                        where C: PaintListener {
    let mut metadata = Vec::new();
    build(&mut metadata, root_stacking_context, &ZERO_POINT);
    compositor.initialize_layers_for_pipeline(pipeline_id, metadata, epoch);

    fn build(metadata: &mut Vec<LayerMetadata>,
             stacking_context: &StackingContext,
             page_position: &Point2D<Au>) {
        let page_position = stacking_context.bounds.origin + *page_position;
        if let Some(ref paint_layer) = stacking_context.layer {
            // Layers start at the top left of their overflow rect, as far as the info we give to
            // the compositor is concerned.
            let overflow_relative_page_position = page_position + stacking_context.overflow.origin;
            let layer_position =
                Rect(Point2D(overflow_relative_page_position.x.to_nearest_px() as i32,
                             overflow_relative_page_position.y.to_nearest_px() as i32),
                     Size2D(stacking_context.overflow.size.width.to_nearest_px() as i32,
                            stacking_context.overflow.size.height.to_nearest_px() as i32));
            metadata.push(LayerMetadata {
                id: paint_layer.id,
                position: layer_position,
                background_color: paint_layer.background_color,
                scroll_policy: paint_layer.scroll_policy,
            })
        }

        for kid in stacking_context.display_list.children.iter() {
            build(metadata, &**kid, &page_position)
        }
    }
}

impl<C> PaintTask<C> where C: PaintListener + Send {
    pub fn create(id: PipelineId,
                  port: Receiver<Msg>,
                  compositor: C,
                  constellation_chan: ConstellationChan,
                  font_cache_task: FontCacheTask,
                  failure_msg: Failure,
                  time_profiler_chan: TimeProfilerChan,
                  shutdown_chan: Sender<()>) {
        let ConstellationChan(c) = constellation_chan.clone();
        spawn_named_with_send_on_failure("PaintTask", task_state::PAINT, proc() {
            {
                // Ensures that the paint task and graphics context are destroyed before the
                // shutdown message.
                let mut compositor = compositor;
                let native_graphics_context = compositor.get_graphics_metadata().map(
                    |md| NativePaintingGraphicsContext::from_metadata(&md));
                let worker_threads = WorkerThreadProxy::spawn(compositor.get_graphics_metadata(),
                                                              font_cache_task,
                                                              time_profiler_chan.clone());

                // FIXME: rust/#5967
                let mut paint_task = PaintTask {
                    id: id,
                    port: port,
                    compositor: compositor,
                    constellation_chan: constellation_chan,
                    time_profiler_chan: time_profiler_chan,
                    native_graphics_context: native_graphics_context,
                    root_stacking_context: None,
                    paint_permission: false,
                    epoch: Epoch(0),
                    buffer_map: BufferMap::new(10000000),
                    worker_threads: worker_threads,
                    used_buffer_count: 0,
                };

                paint_task.start();

                // Destroy all the buffers.
                match paint_task.native_graphics_context.as_ref() {
                    Some(ctx) => paint_task.buffer_map.clear(ctx),
                    None => (),
                }

                // Tell all the worker threads to shut down.
                for worker_thread in paint_task.worker_threads.iter_mut() {
                    worker_thread.exit()
                }
            }

            debug!("paint_task: shutdown_chan send");
            shutdown_chan.send(());
        }, ConstellationMsg::Failure(failure_msg), c, true);
    }

    fn start(&mut self) {
        debug!("PaintTask: beginning painting loop");

        let mut exit_response_channel : Option<Sender<()>> = None;
        let mut waiting_for_compositor_buffers_to_exit = false;
        loop {
            match self.port.recv() {
                Msg::PaintInit(stacking_context) => {
                    self.epoch.next();
                    self.root_stacking_context = Some(stacking_context.clone());

                    if !self.paint_permission {
                        debug!("PaintTask: paint ready msg");
                        let ConstellationChan(ref mut c) = self.constellation_chan;
                        c.send(ConstellationMsg::PainterReady(self.id));
                        continue;
                    }

                    initialize_layers(&mut self.compositor,
                                      self.id,
                                      self.epoch,
                                      &*stacking_context);
                }
                Msg::Paint(requests) => {
                    if !self.paint_permission {
                        debug!("PaintTask: paint ready msg");
                        let ConstellationChan(ref mut c) = self.constellation_chan;
                        c.send(ConstellationMsg::PainterReady(self.id));
                        self.compositor.paint_msg_discarded();
                        continue;
                    }

                    let mut replies = Vec::new();
                    self.compositor.set_paint_state(self.id, PaintState::Painting);
                    for PaintRequest { buffer_requests, scale, layer_id, epoch }
                          in requests.into_iter() {
                        if self.epoch == epoch {
                            self.paint(&mut replies, buffer_requests, scale, layer_id);
                        } else {
                            debug!("painter epoch mismatch: {} != {}", self.epoch, epoch);
                        }
                    }

                    self.compositor.set_paint_state(self.id, PaintState::Idle);

                    for reply in replies.iter() {
                        let &(_, ref buffer_set) = reply;
                        self.used_buffer_count += (*buffer_set).buffers.len();
                    }

                    debug!("PaintTask: returning surfaces");
                    self.compositor.paint(self.id, self.epoch, replies);
                }
                Msg::UnusedBuffer(unused_buffers) => {
                    debug!("PaintTask: Received {} unused buffers", unused_buffers.len());
                    self.used_buffer_count -= unused_buffers.len();

                    for buffer in unused_buffers.into_iter().rev() {
                        self.buffer_map.insert(native_graphics_context!(self), buffer);
                    }

                    if waiting_for_compositor_buffers_to_exit && self.used_buffer_count == 0 {
                        debug!("PaintTask: Received all loaned buffers, exiting.");
                        exit_response_channel.map(|channel| channel.send(()));
                        break;
                    }
                }
                Msg::PaintPermissionGranted => {
                    self.paint_permission = true;

                    match self.root_stacking_context {
                        None => {}
                        Some(ref stacking_context) => {
                            self.epoch.next();
                            initialize_layers(&mut self.compositor,
                                              self.id,
                                              self.epoch,
                                              &**stacking_context);
                        }
                    }
                }
                Msg::PaintPermissionRevoked => {
                    self.paint_permission = false;
                }
                Msg::Exit(response_channel, exit_type) => {
                    let should_wait_for_compositor_buffers = match exit_type {
                        PipelineExitType::Complete => false,
                        PipelineExitType::PipelineOnly => self.used_buffer_count != 0
                    };

                    if !should_wait_for_compositor_buffers {
                        debug!("PaintTask: Exiting without waiting for compositor buffers.");
                        response_channel.map(|channel| channel.send(()));
                        break;
                    }

                    // If we own buffers in the compositor and we are not exiting completely, wait
                    // for the compositor to return buffers, so that we can release them properly.
                    // When doing a complete exit, the compositor lets all buffers leak.
                    println!("PaintTask: Saw ExitMsg, {} buffers in use", self.used_buffer_count);
                    waiting_for_compositor_buffers_to_exit = true;
                    exit_response_channel = response_channel;
                }
            }
        }
    }

    /// Retrieves an appropriately-sized layer buffer from the cache to match the requirements of
    /// the given tile, or creates one if a suitable one cannot be found.
    fn find_or_create_layer_buffer_for_tile(&mut self, tile: &BufferRequest, scale: f32)
                                            -> Option<Box<LayerBuffer>> {
        let width = tile.screen_rect.size.width;
        let height = tile.screen_rect.size.height;
        if opts::get().gpu_painting {
            return None
        }

        match self.buffer_map.find(tile.screen_rect.size) {
            Some(mut buffer) => {
                buffer.rect = tile.page_rect;
                buffer.screen_pos = tile.screen_rect;
                buffer.resolution = scale;
                buffer.native_surface.mark_wont_leak();
                buffer.painted_with_cpu = true;
                buffer.content_age = tile.content_age;
                return Some(buffer)
            }
            None => {}
        }

        // Create an empty native surface. We mark it as not leaking
        // in case it dies in transit to the compositor task.
        let mut native_surface: NativeSurface =
            layers::platform::surface::NativeSurfaceMethods::new(native_graphics_context!(self),
                                                                 Size2D(width as i32,
                                                                        height as i32),
                                                                 width as i32 * 4);
        native_surface.mark_wont_leak();

        Some(box LayerBuffer {
            native_surface: native_surface,
            rect: tile.page_rect,
            screen_pos: tile.screen_rect,
            resolution: scale,
            stride: (width * 4) as uint,
            painted_with_cpu: true,
            content_age: tile.content_age,
        })
    }

    /// Paints one layer and sends the tiles back to the layer.
    fn paint(&mut self,
              replies: &mut Vec<(LayerId, Box<LayerBufferSet>)>,
              mut tiles: Vec<BufferRequest>,
              scale: f32,
              layer_id: LayerId) {
        profile(TimeProfilerCategory::Painting, None, self.time_profiler_chan.clone(), || {
            // Bail out if there is no appropriate stacking context.
            let stacking_context = if let Some(ref stacking_context) = self.root_stacking_context {
                match display_list::find_stacking_context_with_layer_id(stacking_context,
                                                                        layer_id) {
                    Some(stacking_context) => stacking_context,
                    None => return,
                }
            } else {
                return
            };

            // Divide up the layer into tiles and distribute them to workers via a simple round-
            // robin strategy.
            let tiles = mem::replace(&mut tiles, Vec::new());
            let tile_count = tiles.len();
            for (i, tile) in tiles.into_iter().enumerate() {
                let thread_id = i % self.worker_threads.len();
                let layer_buffer = self.find_or_create_layer_buffer_for_tile(&tile, scale);
                self.worker_threads[thread_id].paint_tile(tile,
                                                          layer_buffer,
                                                          stacking_context.clone(),
                                                          scale);
            }
            let new_buffers = Vec::from_fn(tile_count, |i| {
                let thread_id = i % self.worker_threads.len();
                self.worker_threads[thread_id].get_painted_tile_buffer()
            });

            let layer_buffer_set = box LayerBufferSet {
                buffers: new_buffers,
            };
            replies.push((layer_id, layer_buffer_set));
        })
    }
}

struct WorkerThreadProxy {
    sender: Sender<MsgToWorkerThread>,
    receiver: Receiver<MsgFromWorkerThread>,
}

impl WorkerThreadProxy {
    fn spawn(native_graphics_metadata: Option<NativeGraphicsMetadata>,
             font_cache_task: FontCacheTask,
             time_profiler_chan: TimeProfilerChan)
             -> Vec<WorkerThreadProxy> {
        let thread_count = if opts::get().gpu_painting {
            1
        } else {
            opts::get().layout_threads
        };
        Vec::from_fn(thread_count, |_| {
            let (from_worker_sender, from_worker_receiver) = channel();
            let (to_worker_sender, to_worker_receiver) = channel();
            let native_graphics_metadata = native_graphics_metadata.clone();
            let font_cache_task = font_cache_task.clone();
            let time_profiler_chan = time_profiler_chan.clone();
            TaskBuilder::new().spawn(proc() {
                let mut worker_thread = WorkerThread::new(from_worker_sender,
                                                          to_worker_receiver,
                                                          native_graphics_metadata,
                                                          font_cache_task,
                                                          time_profiler_chan);
                worker_thread.main();
            });
            WorkerThreadProxy {
                receiver: from_worker_receiver,
                sender: to_worker_sender,
            }
        })
    }

    fn paint_tile(&mut self,
                  tile: BufferRequest,
                  layer_buffer: Option<Box<LayerBuffer>>,
                  stacking_context: Arc<StackingContext>,
                  scale: f32) {
        self.sender.send(MsgToWorkerThread::PaintTile(tile, layer_buffer, stacking_context, scale))
    }

    fn get_painted_tile_buffer(&mut self) -> Box<LayerBuffer> {
        match self.receiver.recv() {
            MsgFromWorkerThread::PaintedTile(layer_buffer) => layer_buffer,
        }
    }

    fn exit(&mut self) {
        self.sender.send(MsgToWorkerThread::Exit)
    }
}

struct WorkerThread {
    sender: Sender<MsgFromWorkerThread>,
    receiver: Receiver<MsgToWorkerThread>,
    native_graphics_context: Option<NativePaintingGraphicsContext>,
    font_context: Box<FontContext>,
    time_profiler_sender: TimeProfilerChan,
}

impl WorkerThread {
    fn new(sender: Sender<MsgFromWorkerThread>,
           receiver: Receiver<MsgToWorkerThread>,
           native_graphics_metadata: Option<NativeGraphicsMetadata>,
           font_cache_task: FontCacheTask,
           time_profiler_sender: TimeProfilerChan)
           -> WorkerThread {
        WorkerThread {
            sender: sender,
            receiver: receiver,
            native_graphics_context: native_graphics_metadata.map(|metadata| {
                NativePaintingGraphicsContext::from_metadata(&metadata)
            }),
            font_context: box FontContext::new(font_cache_task.clone()),
            time_profiler_sender: time_profiler_sender,
        }
    }

    fn main(&mut self) {
        loop {
            match self.receiver.recv() {
                MsgToWorkerThread::Exit => break,
                MsgToWorkerThread::PaintTile(tile, layer_buffer, stacking_context, scale) => {
                    let draw_target = self.optimize_and_paint_tile(&tile, stacking_context, scale);
                    let buffer = self.create_layer_buffer_for_painted_tile(&tile,
                                                                           layer_buffer,
                                                                           draw_target,
                                                                           scale);
                    self.sender.send(MsgFromWorkerThread::PaintedTile(buffer))
                }
            }
        }
    }

    fn optimize_and_paint_tile(&mut self,
                               tile: &BufferRequest,
                               stacking_context: Arc<StackingContext>,
                               scale: f32)
                               -> DrawTarget {
        let size = Size2D(tile.screen_rect.size.width as i32, tile.screen_rect.size.height as i32);
        let draw_target = if !opts::get().gpu_painting {
            DrawTarget::new(BackendType::SkiaBackend, size, SurfaceFormat::B8G8R8A8)
        } else {
            // FIXME(pcwalton): Cache the components of draw targets (texture color buffer,
            // paintbuffers) instead of recreating them.
            let draw_target = DrawTarget::new_with_fbo(BackendType::SkiaBackend,
                                                       native_graphics_context!(self),
                                                       size,
                                                       SurfaceFormat::B8G8R8A8);
            draw_target.make_current();
            draw_target
        };

        {
            // Build the paint context.
            let mut paint_context = PaintContext {
                draw_target: draw_target.clone(),
                font_ctx: &mut self.font_context,
                page_rect: tile.page_rect,
                screen_rect: tile.screen_rect,
                clip_rect: None,
                transient_clip: None,
            };

            // Apply a translation to start at the boundaries of the stacking context, since the
            // layer's origin starts at its overflow rect's origin.
            let tile_bounds = tile.page_rect.translate(
                &Point2D(stacking_context.overflow.origin.x.to_subpx() as AzFloat,
                         stacking_context.overflow.origin.y.to_subpx() as AzFloat));

            // Apply the translation to paint the tile we want.
            let matrix: Matrix2D<AzFloat> = Matrix2D::identity();
            let matrix = matrix.scale(scale as AzFloat, scale as AzFloat);
            let matrix = matrix.translate(-tile_bounds.origin.x as AzFloat,
                                          -tile_bounds.origin.y as AzFloat);

            // Clear the buffer.
            paint_context.clear();

            // Draw the display list.
            profile(TimeProfilerCategory::PaintingPerTile, None,
                    self.time_profiler_sender.clone(), || {
                stacking_context.optimize_and_draw_into_context(&mut paint_context,
                                                                &tile_bounds,
                                                                &matrix,
                                                                None);
                paint_context.draw_target.flush();
            });
        }

        draw_target
    }

    fn create_layer_buffer_for_painted_tile(&mut self,
                                            tile: &BufferRequest,
                                            layer_buffer: Option<Box<LayerBuffer>>,
                                            draw_target: DrawTarget,
                                            scale: f32)
                                            -> Box<LayerBuffer> {
        // Extract the texture from the draw target and place it into its slot in the buffer. If
        // using CPU painting, upload it first.
        //
        // FIXME(pcwalton): We should supply the texture and native surface *to* the draw target in
        // GPU painting mode, so that it doesn't have to recreate it.
        if !opts::get().gpu_painting {
            let mut buffer = layer_buffer.unwrap();
            draw_target.snapshot().get_data_surface().with_data(|data| {
                buffer.native_surface.upload(native_graphics_context!(self), data);
                debug!("painting worker thread uploading to native surface {}",
                       buffer.native_surface.get_id());
            });
            return buffer
        }

        // GPU painting path:
        draw_target.make_current();
        let StolenGLResources {
            surface: native_surface
        } = draw_target.steal_gl_resources().unwrap();

        // We mark the native surface as not leaking in case the surfaces
        // die on their way to the compositor task.
        let mut native_surface: NativeSurface =
            NativeSurfaceAzureMethods::from_azure_surface(native_surface);
        native_surface.mark_wont_leak();

        box LayerBuffer {
            native_surface: native_surface,
            rect: tile.page_rect,
            screen_pos: tile.screen_rect,
            resolution: scale,
            stride: (tile.screen_rect.size.width * 4) as uint,
            painted_with_cpu: false,
            content_age: tile.content_age,
        }
    }
}

enum MsgToWorkerThread {
    Exit,
    PaintTile(BufferRequest, Option<Box<LayerBuffer>>, Arc<StackingContext>, f32),
}

enum MsgFromWorkerThread {
    PaintedTile(Box<LayerBuffer>),
}
