import CompanyForm from "@/components/CompanyForm";
import { createCompany } from "../../actions";

export default function NewCompany() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Add company</h1>
      <CompanyForm action={createCompany} submitLabel="Save company" />
    </div>
  );
}
