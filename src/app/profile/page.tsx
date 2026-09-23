import Link from "next/link";
import { saveProfileAction } from "../actions";
import { ProfileForm } from "../../components/profile-form";
import { getServices } from "../../lib/services/container";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = getServices().profiles.getCurrentProfile();
  return <main className="page-shell narrow-page"><nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Pipeline</Link><span aria-hidden="true">/</span><span>Profile</span></nav><div className="page-intro"><p className="eyebrow">Your source of truth</p><h1>Candidate profile</h1><p>Record facts you can stand behind. The agents use this profile to ground fit evidence and application drafts.</p>{profile && <p className="version-tag">Current version {profile.version}</p>}</div><div className="card form-card"><ProfileForm profile={profile} onSave={saveProfileAction} /></div></main>;
}
