import StreamClient from './StreamClient';

export default function StreamPage() {
  // Same-origin proxy path — Next rewrites /detector/* to the detector service.
  const detectorUrl = '/detector';

  return <StreamClient detectorUrl={detectorUrl} />;
}
