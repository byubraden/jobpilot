import Link from "next/link";
import { createJobAction } from "../../actions";
import { JobForm } from "../../../components/job-form";

export default async function NewJobPage() {
  return <main className="page-shell narrow-page"><nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Pipeline</Link><span aria-hidden="true">/</span><span>Add job</span></nav><div className="page-intro"><p className="eyebrow">New opportunity</p><h1>Add a job</h1><p>Save the full description, choose how analysis runs, and review the results before you apply.</p></div><div className="card form-card"><JobForm onCreate={createJobAction} /></div></main>;
}
