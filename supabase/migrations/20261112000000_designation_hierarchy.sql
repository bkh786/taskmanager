-- Reporting hierarchy by designation: each designation can name the designation
-- its holders report to (e.g. PM -> Area Operations Manager). The "Reports to"
-- picker then lists the people holding that designation.
alter table public.designations
  add column if not exists reports_to_designation_id uuid
    references public.designations(id) on delete set null;

create index if not exists designations_reports_to_idx
  on public.designations (reports_to_designation_id);
