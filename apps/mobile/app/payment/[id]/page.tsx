import { fetchPaymentSessionByShortId } from '../../../lib/api';
import { notFound } from 'next/navigation';
import { PaymentPageClient } from './PaymentPageClient';

interface Props {
  params: { id: string };
}

export default async function PaymentPage({ params }: Props) {
  const session = await fetchPaymentSessionByShortId(params.id);
  if (!session) notFound();
  return <PaymentPageClient session={session} />;
}
