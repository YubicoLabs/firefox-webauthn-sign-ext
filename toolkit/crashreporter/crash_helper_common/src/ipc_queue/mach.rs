/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

use std::{
    collections::HashMap,
    ffi::c_int,
    mem::zeroed,
    os::fd::{AsRawFd, FromRawFd, OwnedFd},
    ptr::{null, null_mut},
    rc::Rc,
};

use mach2::{
    kern_return::{kern_return_t, KERN_SUCCESS},
    mach_types::ipc_space_t,
    message::{mach_msg_id_t, mach_msg_type_name_t, MACH_MSG_TYPE_MAKE_SEND_ONCE},
    port::{mach_port_name_t, mach_port_t, MACH_PORT_NULL},
    traps::mach_task_self,
};
use nix::{
    errno::Errno,
    libc::{kevent, kqueue, EVFILT_MACHPORT, EV_ADD, EV_ENABLE},
};

use crate::{
    errors::IPCError, ipc_queue::IPCQueueError, platform::PlatformError, IPCConnector,
    IPCConnectorKey, IPCEvent, IPCListener,
};

#[allow(non_camel_case_types)]
type mach_port_mscount_t = u32;

const MACH_NOTIFY_NO_SENDERS: c_int = 0o106;

unsafe extern "C" {
    fn mach_port_request_notification(
        task: ipc_space_t,
        name: mach_port_name_t,
        variant: mach_msg_id_t,
        sync: mach_port_mscount_t,
        notify: mach_port_t,
        notifyPoly: mach_msg_type_name_t,
        previous: *mut mach_port_t,
    ) -> kern_return_t;
}

pub struct IPCQueue {
    queue: OwnedFd,
    connectors: HashMap<IPCConnectorKey, Rc<IPCConnector>>,
}

impl IPCQueue {
    pub fn new(_listener: IPCListener) -> Result<IPCQueue, IPCQueueError> {
        let queue = unsafe {
            let fd = kqueue();

            if fd < 0 {
                return Err(IPCQueueError::CreationFailure(
                    PlatformError::KernelQueueError(Errno::last()),
                ));
            }

            OwnedFd::from_raw_fd(fd)
        };
        let connectors = HashMap::with_capacity(10);

        Ok(IPCQueue { queue, connectors })
    }

    pub fn add_connector(&mut self, connector: &Rc<IPCConnector>) -> Result<(), IPCQueueError> {
        let port = connector.raw_recv_right();
        notify_disconnect(port).map_err(IPCQueueError::RegistrationFailure)?;
        let event = kevent {
            ident: port as usize,
            filter: EVFILT_MACHPORT,
            flags: EV_ADD | EV_ENABLE,
            fflags: 0,
            data: 0,
            udata: null_mut(),
        };
        let res = unsafe { kevent(self.queue.as_raw_fd(), &event, 1, null_mut(), 0, null()) };
        if res < 0 {
            return Err(IPCQueueError::RegistrationFailure(
                PlatformError::KernelEventError(Errno::last()),
            ));
        }

        let res = self.connectors.insert(connector.key(), connector.clone());
        debug_assert!(res.is_none());

        Ok(())
    }

    pub fn wait_for_events(&mut self) -> Result<Vec<IPCEvent>, IPCQueueError> {
        // SAFETY: This must be zeroed as it will be populated by `kqueue()`
        let mut event = kevent {
            ..unsafe { zeroed() }
        };

        let res = unsafe { kevent(self.queue.as_raw_fd(), null(), 0, &mut event, 1, null()) };
        if res < 0 {
            return Err(IPCQueueError::WaitError(PlatformError::KernelEventError(
                Errno::last(),
            )));
        }

        let raw_mach_port: mach_port_t = event
            .data
            .try_into()
            .expect("event.data must contain a valid Mach port");
        let connector = self
            .connectors
            .get(&raw_mach_port)
            .expect("Event did not match a known connector");

        let header = match connector.recv_header() {
            Ok(header) => header,
            Err(_error @ IPCError::ReceptionFailure(PlatformError::NoMoreSenders)) => {
                return Ok(vec![IPCEvent::Disconnect(raw_mach_port)]);
            }
            Err(error) => return Err(IPCQueueError::IPCError(error)),
        };

        let payload = match connector.recv(header.size) {
            Ok(payload) => payload,
            Err(_error @ IPCError::ReceptionFailure(PlatformError::NoMoreSenders)) => {
                return Ok(vec![IPCEvent::Disconnect(raw_mach_port)]);
            }
            Err(error) => return Err(IPCQueueError::IPCError(error)),
        };

        Ok(vec![IPCEvent::Message(
            raw_mach_port,
            header,
            payload.0,
            payload.1,
        )])
    }
}

// Send a message when the last send right for this port is dropped
fn notify_disconnect(port: mach_port_t) -> Result<(), PlatformError> {
    let mut previous = MACH_PORT_NULL;
    let rv = unsafe {
        mach_port_request_notification(
            mach_task_self(),
            port,
            MACH_NOTIFY_NO_SENDERS,
            /* sync */ 0,
            port,
            MACH_MSG_TYPE_MAKE_SEND_ONCE,
            &mut previous,
        )
    };

    if rv != KERN_SUCCESS {
        Err(PlatformError::RequestNotification(rv))
    } else {
        Ok(())
    }
}
