import { AccountDetail } from "@/components/management/AccountDetail";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountDetail key={id} id={id} />;
}
