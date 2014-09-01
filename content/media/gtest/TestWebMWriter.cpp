/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "gtest/gtest.h"
#include "mozilla/CheckedInt.h"
#include "mozilla/MathAlgorithms.h"
#include "nestegg/nestegg.h"
#include "VorbisTrackEncoder.h"
#include "VP8TrackEncoder.h"
#include "WebMWriter.h"

using namespace mozilla;

class WebMVorbisTrackEncoder : public VorbisTrackEncoder
{
public:
  bool TestVorbisCreation(int aChannels, int aSamplingRate)
  {
    if (NS_SUCCEEDED(Init(aChannels, aSamplingRate))) {
      return true;
    }
    return false;
  }
};

class WebMVP8TrackEncoder: public VP8TrackEncoder
{
public:
  bool TestVP8Creation(int32_t aWidth, int32_t aHeight, int32_t aDisplayWidth,
                       int32_t aDisplayHeight, TrackRate aTrackRate)
  {
    if (NS_SUCCEEDED(Init(aWidth, aHeight, aDisplayWidth, aDisplayHeight,
                          aTrackRate))) {
      return true;
    }
    return false;
  }
};

const uint64_t FIXED_DURATION = 1000000;
const uint32_t FIXED_FRAMESIZE = 500;

class TestWebMWriter: public WebMWriter
{
public:
  explicit TestWebMWriter(int aTrackTypes)
  : WebMWriter(aTrackTypes),
    mTimestamp(0)
  {}

  void SetVorbisMetadata(int aChannels, int aSampleRate) {
    WebMVorbisTrackEncoder vorbisEncoder;
    EXPECT_TRUE(vorbisEncoder.TestVorbisCreation(aChannels, aSampleRate));
    nsRefPtr<TrackMetadataBase> vorbisMeta = vorbisEncoder.GetMetadata();
    SetMetadata(vorbisMeta);
  }
  void SetVP8Metadata(int32_t aWidth, int32_t aHeight, int32_t aDisplayWidth,
                      int32_t aDisplayHeight,TrackRate aTrackRate) {
    WebMVP8TrackEncoder vp8Encoder;
    EXPECT_TRUE(vp8Encoder.TestVP8Creation(aWidth, aHeight, aDisplayWidth,
                                           aDisplayHeight, aTrackRate));
    nsRefPtr<TrackMetadataBase> vp8Meta = vp8Encoder.GetMetadata();
    SetMetadata(vp8Meta);
  }

  // When we append an I-Frame into WebM muxer, the muxer will treat previous
  // data as "a cluster".
  // In these test cases, we will call the function many times to enclose the
  // previous cluster so that we can retrieve data by |GetContainerData|.
  void AppendDummyFrame(EncodedFrame::FrameType aFrameType,
                        uint64_t aDuration) {
    EncodedFrameContainer encodedVideoData;
    nsTArray<uint8_t> frameData;
    nsRefPtr<EncodedFrame> videoData = new EncodedFrame();
    // Create dummy frame data.
    frameData.SetLength(FIXED_FRAMESIZE);
    videoData->SetFrameType(aFrameType);
    videoData->SetTimeStamp(mTimestamp);
    videoData->SetDuration(aDuration);
    videoData->SwapInFrameData(frameData);
    encodedVideoData.AppendEncodedFrame(videoData);
    WriteEncodedTrack(encodedVideoData, 0);
    mTimestamp += aDuration;
  }

  bool HaveValidCluster() {
    nsTArray<nsTArray<uint8_t> > encodedBuf;
    GetContainerData(&encodedBuf, 0);
    return (encodedBuf.Length() > 0) ? true : false;
  }

  // Timestamp accumulator that increased by AppendDummyFrame.
  // Keep it public that we can do some testcases about it.
  uint64_t mTimestamp;
};

TEST(WebMWriter, Metadata)
{
  TestWebMWriter writer(ContainerWriter::CREATE_AUDIO_TRACK |
                        ContainerWriter::CREATE_VIDEO_TRACK);

  // The output should be empty since we didn't set any metadata in writer.
  nsTArray<nsTArray<uint8_t> > encodedBuf;
  writer.GetContainerData(&encodedBuf, ContainerWriter::GET_HEADER);
  EXPECT_TRUE(encodedBuf.Length() == 0);
  writer.GetContainerData(&encodedBuf, ContainerWriter::FLUSH_NEEDED);
  EXPECT_TRUE(encodedBuf.Length() == 0);

  // Set vorbis metadata.
  int channel = 1;
  int sampleRate = 44100;
  writer.SetVorbisMetadata(channel, sampleRate);

  // No output data since we didn't set both audio/video
  // metadata in writer.
  writer.GetContainerData(&encodedBuf, ContainerWriter::GET_HEADER);
  EXPECT_TRUE(encodedBuf.Length() == 0);
  writer.GetContainerData(&encodedBuf, ContainerWriter::FLUSH_NEEDED);
  EXPECT_TRUE(encodedBuf.Length() == 0);

  // Set vp8 metadata
  int32_t width = 640;
  int32_t height = 480;
  int32_t displayWidth = 640;
  int32_t displayHeight = 480;
  TrackRate aTrackRate = 90000;
  writer.SetVP8Metadata(width, height, displayWidth,
                        displayHeight, aTrackRate);

  writer.GetContainerData(&encodedBuf, ContainerWriter::GET_HEADER);
  EXPECT_TRUE(encodedBuf.Length() > 0);
}

TEST(WebMWriter, Cluster)
{
  TestWebMWriter writer(ContainerWriter::CREATE_AUDIO_TRACK |
                        ContainerWriter::CREATE_VIDEO_TRACK);
  // Set vorbis metadata.
  int channel = 1;
  int sampleRate = 48000;
  writer.SetVorbisMetadata(channel, sampleRate);
  // Set vp8 metadata
  int32_t width = 320;
  int32_t height = 240;
  int32_t displayWidth = 320;
  int32_t displayHeight = 240;
  TrackRate aTrackRate = 90000;
  writer.SetVP8Metadata(width, height, displayWidth,
                        displayHeight, aTrackRate);

  nsTArray<nsTArray<uint8_t> > encodedBuf;
  writer.GetContainerData(&encodedBuf, ContainerWriter::GET_HEADER);
  EXPECT_TRUE(encodedBuf.Length() > 0);
  encodedBuf.Clear();

  // write the first I-Frame.
  writer.AppendDummyFrame(EncodedFrame::VP8_I_FRAME, FIXED_DURATION);
  // No data because the cluster is not closed.
  EXPECT_FALSE(writer.HaveValidCluster());

  // The second I-Frame.
  writer.AppendDummyFrame(EncodedFrame::VP8_I_FRAME, FIXED_DURATION);
  // Should have data because the first cluster is closed.
  EXPECT_TRUE(writer.HaveValidCluster());

  // P-Frame.
  writer.AppendDummyFrame(EncodedFrame::VP8_P_FRAME, FIXED_DURATION);
  // No data because the cluster is not closed.
  EXPECT_FALSE(writer.HaveValidCluster());

  // The third I-Frame.
  writer.AppendDummyFrame(EncodedFrame::VP8_I_FRAME, FIXED_DURATION);
  // Should have data because the second cluster is closed.
  EXPECT_TRUE(writer.HaveValidCluster());
}

TEST(WebMWriter, FLUSH_NEEDED)
{
  TestWebMWriter writer(ContainerWriter::CREATE_AUDIO_TRACK |
                        ContainerWriter::CREATE_VIDEO_TRACK);
  // Set vorbis metadata.
  int channel = 2;
  int sampleRate = 44100;
  writer.SetVorbisMetadata(channel, sampleRate);
  // Set vp8 metadata
  int32_t width = 176;
  int32_t height = 352;
  int32_t displayWidth = 176;
  int32_t displayHeight = 352;
  TrackRate aTrackRate = 100000;
  writer.SetVP8Metadata(width, height, displayWidth,
                        displayHeight, aTrackRate);

  // write the first I-Frame.
  writer.AppendDummyFrame(EncodedFrame::VP8_I_FRAME, FIXED_DURATION);

  // P-Frame
  writer.AppendDummyFrame(EncodedFrame::VP8_P_FRAME, FIXED_DURATION);
  // Have data because the metadata is finished.
  EXPECT_TRUE(writer.HaveValidCluster());
  // No data because the cluster is not closed and the metatdata had been
  // retrieved
  EXPECT_FALSE(writer.HaveValidCluster());

  nsTArray<nsTArray<uint8_t> > encodedBuf;
  // Have data because the flag ContainerWriter::FLUSH_NEEDED
  writer.GetContainerData(&encodedBuf, ContainerWriter::FLUSH_NEEDED);
  EXPECT_TRUE(encodedBuf.Length() > 0);
  encodedBuf.Clear();

  // P-Frame
  writer.AppendDummyFrame(EncodedFrame::VP8_P_FRAME, FIXED_DURATION);
  // No data because there is no cluster right now. The I-Frame had been
  // flushed out.
  EXPECT_FALSE(writer.HaveValidCluster());

  // I-Frame
  writer.AppendDummyFrame(EncodedFrame::VP8_I_FRAME, FIXED_DURATION);
  // No data because a cluster must starts form I-Frame and the
  // cluster is not closed.
  EXPECT_FALSE(writer.HaveValidCluster());

  // I-Frame
  writer.AppendDummyFrame(EncodedFrame::VP8_I_FRAME, FIXED_DURATION);
  // Have data because the previous cluster is closed.
  EXPECT_TRUE(writer.HaveValidCluster());
}

struct WebMioData {
  nsTArray<uint8_t> data;
  CheckedInt<size_t> offset;
};

static int webm_read(void* aBuffer, size_t aLength, void* aUserData)
{
  NS_ASSERTION(aUserData, "aUserData must point to a valid WebMioData");
  WebMioData* ioData = static_cast<WebMioData*>(aUserData);

  // Check the read length.
  if (aLength > ioData->data.Length()) {
    NS_ERROR("Invalid read length");
    return -1;
  }

  // Check eos.
  if (ioData->offset.value() >= ioData->data.Length()) {
    return 0;
  }

  size_t oldOffset = ioData->offset.value();
  ioData->offset += aLength;
  if (!ioData->offset.isValid() ||
      (ioData->offset.value() > ioData->data.Length())) {
    return -1;
  }
  memcpy(aBuffer, ioData->data.Elements()+oldOffset, aLength);
  return 1;
}

static int webm_seek(int64_t aOffset, int aWhence, void* aUserData)
{
  NS_ASSERTION(aUserData, "aUserData must point to a valid WebMioData");
  WebMioData* ioData = static_cast<WebMioData*>(aUserData);

  if (Abs(aOffset) > ioData->data.Length()) {
    NS_ERROR("Invalid aOffset");
    return -1;
  }

  switch (aWhence) {
    case NESTEGG_SEEK_END:
    {
      CheckedInt<size_t> tempOffset = ioData->data.Length();
      ioData->offset = tempOffset + aOffset;
      break;
    }
    case NESTEGG_SEEK_CUR:
      ioData->offset += aOffset;
      break;
    case NESTEGG_SEEK_SET:
      ioData->offset = aOffset;
      break;
    default:
      NS_ERROR("Unknown whence");
      return -1;
  }

  if (!ioData->offset.isValid()) {
    NS_ERROR("Invalid offset");
    return -1;
  }

  return 1;
}

static int64_t webm_tell(void* aUserData)
{
  NS_ASSERTION(aUserData, "aUserData must point to a valid WebMioData");
  WebMioData* ioData = static_cast<WebMioData*>(aUserData);
  return ioData->offset.isValid() ? ioData->offset.value() : -1;
}

TEST(WebMWriter, bug970774_aspect_ratio)
{
  TestWebMWriter writer(ContainerWriter::CREATE_AUDIO_TRACK |
                        ContainerWriter::CREATE_VIDEO_TRACK);
  // Set vorbis metadata.
  int channel = 1;
  int sampleRate = 44100;
  writer.SetVorbisMetadata(channel, sampleRate);
  // Set vp8 metadata
  int32_t width = 640;
  int32_t height = 480;
  int32_t displayWidth = 1280;
  int32_t displayHeight = 960;
  TrackRate aTrackRate = 90000;
  writer.SetVP8Metadata(width, height, displayWidth,
                        displayHeight, aTrackRate);

  // write the first I-Frame.
  writer.AppendDummyFrame(EncodedFrame::VP8_I_FRAME, FIXED_DURATION);

  // write the second I-Frame.
  writer.AppendDummyFrame(EncodedFrame::VP8_I_FRAME, FIXED_DURATION);

  // Get the metadata and the first cluster.
  nsTArray<nsTArray<uint8_t> > encodedBuf;
  writer.GetContainerData(&encodedBuf, 0);
  // Flatten the encodedBuf.
  WebMioData ioData;
  ioData.offset = 0;
  for(uint32_t i = 0 ; i < encodedBuf.Length(); ++i) {
    ioData.data.AppendElements(encodedBuf[i]);
  }

  // Use nestegg to verify the information in metadata.
  nestegg* context = nullptr;
  nestegg_io io;
  io.read = webm_read;
  io.seek = webm_seek;
  io.tell = webm_tell;
  io.userdata = static_cast<void*>(&ioData);
  int rv = nestegg_init(&context, io, nullptr, -1);
  EXPECT_EQ(rv, 0);
  unsigned int ntracks = 0;
  rv = nestegg_track_count(context, &ntracks);
  EXPECT_EQ(rv, 0);
  EXPECT_EQ(ntracks, (unsigned int)2);
  for (unsigned int track = 0; track < ntracks; ++track) {
    int id = nestegg_track_codec_id(context, track);
    EXPECT_NE(id, -1);
    int type = nestegg_track_type(context, track);
    if (type == NESTEGG_TRACK_VIDEO) {
      nestegg_video_params params;
      rv = nestegg_track_video_params(context, track, &params);
      EXPECT_EQ(rv, 0);
      EXPECT_EQ(width, static_cast<int32_t>(params.width));
      EXPECT_EQ(height, static_cast<int32_t>(params.height));
      EXPECT_EQ(displayWidth, static_cast<int32_t>(params.display_width));
      EXPECT_EQ(displayHeight, static_cast<int32_t>(params.display_height));
    } else if (type == NESTEGG_TRACK_AUDIO) {
      nestegg_audio_params params;
      rv = nestegg_track_audio_params(context, track, &params);
      EXPECT_EQ(rv, 0);
      EXPECT_EQ(channel, static_cast<int>(params.channels));
      EXPECT_EQ(static_cast<double>(sampleRate), params.rate);
    }
  }
  if (context) {
    nestegg_destroy(context);
  }
}

