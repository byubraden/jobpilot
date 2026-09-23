import Link from "next/link";
import { JobList } from "../components/job-card";
import { getServices } from "../lib/services/container";

export const dynamic = "force-dynamic";

export default async function Home() {
  const services = getServices();
  const jobs = services.jobs.listJobs();
  const profile = services.profiles.getCurrentProfile();
  return <main className="page-shell">
    <section className="hero"><div><p className="eyebrow">Local application workspace</p><h1>Find your next move with clarity.</h1><p className="hero-copy">Save roles, review grounded AI suggestions, and track each application from first look to final outcome.</p><div className="button-row"><Link className="button button-primary" href="/jobs/new">Add a job <span aria-hidden="true">↗</span></Link><Link className="button button-secondary" href="/profile">{profile ? "Edit candidate profile" : "Create candidate profile"}</Link></div></div><div className="hero-aside"><span className="hero-number">{jobs.length.toString().padStart(2, "0")}</span><span>roles in your pipeline</span></div></section>
    {!profile && <div className="notice dashboard-notice"><strong>Start with your profile.</strong> Agents use the facts you provide to ground their suggestions. <Link href="/profile">Create your candidate profile</Link>.</div>}
    <JobList jobs={jobs} />
  </main>;
}
