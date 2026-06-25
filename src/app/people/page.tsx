import {
  getContractors,
  getRoyaltyOwners,
  getServiceProviders,
} from "@/lib/people/people";
import { getWellNameMap } from "@/lib/wells/wells";
import { PeopleWorkspace } from "@/components/people/people-workspace";
import { requirePermission } from "@/lib/auth/permissions";

export default async function PeoplePage() {
  await requirePermission("view_people");
  const [contractors, serviceProviders, royaltyOwners, wellNameById] =
    await Promise.all([
      getContractors(),
      getServiceProviders(),
      getRoyaltyOwners(),
      getWellNameMap(),
    ]);

  return (
    <PeopleWorkspace
      contractors={contractors}
      serviceProviders={serviceProviders}
      royaltyOwners={royaltyOwners}
      wellNameById={wellNameById}
    />
  );
}
