import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config.js';
import type { TranscriptSegment } from '@medical-ai/shared';

const transcribeClient = new TranscribeClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

export async function uploadAudioToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.aws.transcribeBucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `s3://${config.aws.transcribeBucket}/${key}`;
}

export async function startTranscriptionJob(
  jobName: string,
  audioS3Uri: string,
  mediaFormat: 'mp3' | 'mp4' | 'wav' | 'm4a' = 'm4a'
): Promise<void> {
  await transcribeClient.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: { MediaFileUri: audioS3Uri },
      MediaFormat: mediaFormat,
      LanguageCode: 'en-US',
      Settings: {
        ShowSpeakerLabels: true,
        MaxSpeakerLabels: 2,
      },
      OutputBucketName: config.aws.transcribeBucket,
      OutputKey: `transcripts/${jobName}.json`,
    })
  );
}

export async function getTranscriptionJob(jobName: string) {
  const resp = await transcribeClient.send(
    new GetTranscriptionJobCommand({ TranscriptionJobName: jobName })
  );
  return resp.TranscriptionJob;
}

// Parse AWS Transcribe JSON output into our TranscriptSegment[] format.
// AWS output has items (words) with speaker_label and start_time/end_time.
// We group consecutive items by speaker into segments.
export async function fetchAndParseTranscript(jobName: string): Promise<TranscriptSegment[]> {
  const key = `transcripts/${jobName}.json`;
  const resp = await s3Client.send(
    new GetObjectCommand({ Bucket: config.aws.transcribeBucket, Key: key })
  );
  const body = await resp.Body?.transformToString();
  if (!body) return [];
  const data = JSON.parse(body);

  const items: Array<{
    start_time?: string;
    end_time?: string;
    alternatives: { content: string }[];
    speaker_label?: string;
    type: string;
  }> = data.results?.items || [];

  const segments: TranscriptSegment[] = [];
  let current: TranscriptSegment | null = null;

  for (const item of items) {
    const word = item.alternatives[0]?.content || '';
    const speaker = item.speaker_label || 'SPEAKER_0';

    if (item.type === 'punctuation') {
      if (current) current.text += word;
      continue;
    }

    const start = item.start_time ? parseFloat(item.start_time) : 0;
    const end = item.end_time ? parseFloat(item.end_time) : start;

    if (current && current.speaker === speaker) {
      current.text += ' ' + word;
      current.end = end;
    } else {
      if (current) segments.push(current);
      current = { speaker, text: word, start, end };
    }
  }
  if (current) segments.push(current);
  return segments;
}
