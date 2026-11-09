import { AccountDetail } from "@/components/management/AccountDetail";
import { RememberedDeviceCard } from "@/components/auth/RememberedDeviceCard";
import { AccountSessionsCard } from "@/components/auth/AccountSessionsCard";

export default function OwnAccountPage() {
  return <><AccountDetail /><RememberedDeviceCard /><AccountSessionsCard /></>;
}
