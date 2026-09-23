"use client";

import Link from "next/link";
import { useState } from "react";
import type { JobRecord } from "../lib/db/repositories";
import { ApplicationStatusSchema, type ApplicationStatus } from "../lib/domain/schemas";

export function JobCard({ job }: { job: JobRecord }) {
  const summary = job.description.trim().replace(/\s+/g, " ");
  return (
    <article className="job-card card">
      <div className="job-card-top"><span className="eyebrow">Job {job.id}</span><span className={`status status-${job.status}`}>{job.status}</span></div>
      <p>{summary.length > 170 ? `${summary.slice(0, 167)}…` : summary}</p>
      <div className="card-footer"><span>Saved {new Date(job.createdAt).toLocaleDateString()}</span><Link href={`/jobs/${job.id}`} aria-label={`View job ${job.id}`}>View job <span aria-hidden="true">↗</span></Link></div>
    </article>
  );
}

export function JobList({ jobs }: { jobs: JobRecord[] }) {
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");
  const statuses = ApplicationStatusSchema.options;
  const visibleJobs = filter === "all" ? jobs : jobs.filter((job) => job.status === filter);
  return (
    <section aria-labelledby="pipeline-heading">
      <div className="section-heading"><div><p className="eyebrow">Your workspace</p><h2 id="pipeline-heading">Application pipeline</h2></div><span className="count-badge">{jobs.length} total</span></div>
      <div className="filter-bar" role="group" aria-label="Filter jobs by status">
        <button type="button" className={filter === "all" ? "filter active" : "filter"} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All <span>{jobs.length}</span></button>
        {statuses.map((status) => <button key={status} type="button" className={filter === status ? "filter active" : "filter"} aria-pressed={filter === status} onClick={() => setFilter(status)}>{status} <span>{jobs.filter((job) => job.status === status).length}</span></button>)}
      </div>
      {visibleJobs.length ? <div className="job-grid">{visibleJobs.map((job) => <JobCard key={job.id} job={job} />)}</div> : <div className="empty-state card"><h3>{jobs.length ? `No ${filter} jobs yet` : "Your pipeline starts here"}</h3><p>{jobs.length ? "Choose another status to see saved jobs." : "Add a job description to begin preparing an application."}</p><Link className="button button-primary" href="/jobs/new">Add a job</Link></div>}
    </section>
  );
}
