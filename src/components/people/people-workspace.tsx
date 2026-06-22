"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createContractor,
  createRoyaltyOwner,
  createServiceProvider,
  updateContractor,
  updateRoyaltyOwner,
  updateServiceProvider,
} from "@/lib/people/actions";
import { ContractorsTable } from "@/components/people/contractors-table";
import { ServiceProvidersTable } from "@/components/people/service-providers-table";
import { RoyaltyOwnersTable } from "@/components/people/royalty-owners-table";
import { AddPersonModal, type NewPerson } from "@/components/people/add-person-modal";
import {
  EditPersonModal,
  type EditingPerson,
} from "@/components/people/edit-person-modal";
import type { PersonData } from "@/components/people/person-form";
import type {
  Contractor,
  PeopleCategory,
  RoyaltyOwner,
  ServiceProvider,
} from "@/lib/people/people";

const TABS: { value: PeopleCategory; label: string }[] = [
  { value: "contractors", label: "Contractors" },
  { value: "service-providers", label: "Service Providers" },
  { value: "royalty-owners", label: "Royalty Owners" },
];

export function PeopleWorkspace({
  contractors: initialContractors,
  serviceProviders: initialServiceProviders,
  royaltyOwners: initialRoyaltyOwners,
  wellNameById,
}: {
  contractors: Contractor[];
  serviceProviders: ServiceProvider[];
  royaltyOwners: RoyaltyOwner[];
  wellNameById: Record<string, string>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<PeopleCategory>("contractors");
  const [contractors, setContractors] = useState(initialContractors);
  const [serviceProviders, setServiceProviders] = useState(
    initialServiceProviders
  );
  const [royaltyOwners, setRoyaltyOwners] = useState(initialRoyaltyOwners);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<EditingPerson | null>(null);
  const [, startTransition] = useTransition();

  // Re-sync from the server after a mutation refresh.
  useEffect(() => {
    setContractors(initialContractors);
  }, [initialContractors]);
  useEffect(() => {
    setServiceProviders(initialServiceProviders);
  }, [initialServiceProviders]);
  useEffect(() => {
    setRoyaltyOwners(initialRoyaltyOwners);
  }, [initialRoyaltyOwners]);

  function handleAddPerson(person: NewPerson) {
    // Optimistically show the new person, then persist and re-sync.
    switch (person.kind) {
      case "contractors":
        setContractors((prev) => [
          { id: `c-local-${Date.now()}`, ...person.data },
          ...prev,
        ]);
        break;
      case "service-providers":
        setServiceProviders((prev) => [
          { id: `s-local-${Date.now()}`, ...person.data },
          ...prev,
        ]);
        break;
      case "royalty-owners":
        setRoyaltyOwners((prev) => [
          { id: `r-local-${Date.now()}`, ...person.data },
          ...prev,
        ]);
        break;
    }
    // Show the category the new person was added to.
    setTab(person.kind);

    startTransition(async () => {
      try {
        switch (person.kind) {
          case "contractors":
            await createContractor(person.data);
            break;
          case "service-providers":
            await createServiceProvider(person.data);
            break;
          case "royalty-owners":
            await createRoyaltyOwner(person.data);
            break;
        }
        router.refresh();
      } catch (error) {
        console.error("Failed to add person", error);
      }
    });
  }

  function handleSaveEdit(id: string, person: PersonData) {
    // Optimistically apply the edit, then persist and re-sync.
    switch (person.kind) {
      case "contractors":
        setContractors((prev) =>
          prev.map((c) => (c.id === id ? { id, ...person.data } : c))
        );
        break;
      case "service-providers":
        setServiceProviders((prev) =>
          prev.map((s) => (s.id === id ? { id, ...person.data } : s))
        );
        break;
      case "royalty-owners":
        setRoyaltyOwners((prev) =>
          prev.map((o) => (o.id === id ? { id, ...person.data } : o))
        );
        break;
    }

    startTransition(async () => {
      try {
        switch (person.kind) {
          case "contractors":
            await updateContractor(id, person.data);
            break;
          case "service-providers":
            await updateServiceProvider(id, person.data);
            break;
          case "royalty-owners":
            await updateRoyaltyOwner(id, person.data);
            break;
        }
        router.refresh();
      } catch (error) {
        console.error("Failed to update person", error);
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header-styled menu replaces the page title, with the add action at right. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "font-heading text-2xl font-semibold tracking-tight transition-colors",
                tab === t.value
                  ? "text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button size="lg" onClick={() => setAddOpen(true)}>
          <PlusIcon />
          Person
        </Button>
      </div>

      {tab === "contractors" && (
        <ContractorsTable
          contractors={contractors}
          onRowClick={(c) =>
            setEditing({
              id: c.id,
              person: { kind: "contractors", data: c },
            })
          }
        />
      )}
      {tab === "service-providers" && (
        <ServiceProvidersTable
          providers={serviceProviders}
          onRowClick={(s) =>
            setEditing({
              id: s.id,
              person: { kind: "service-providers", data: s },
            })
          }
        />
      )}
      {tab === "royalty-owners" && (
        <RoyaltyOwnersTable
          owners={royaltyOwners}
          wellNameById={wellNameById}
          onRowClick={(o) =>
            setEditing({
              id: o.id,
              person: { kind: "royalty-owners", data: o },
            })
          }
        />
      )}

      <AddPersonModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddPerson}
      />

      <EditPersonModal
        editing={editing}
        onClose={() => setEditing(null)}
        onSubmit={handleSaveEdit}
      />
    </div>
  );
}
