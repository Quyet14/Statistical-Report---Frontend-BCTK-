import { DepartmentDetail } from "@/components/management/DepartmentDetail";

export default async function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DepartmentDetail key={id} id={id} />;
}
