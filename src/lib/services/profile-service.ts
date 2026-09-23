import { CandidateProfileInputSchema } from "../domain/schemas";
import type { ProfileRepository } from "../db/repositories";

export class ProfileService {
  constructor(private readonly profiles: ProfileRepository) {}

  getCurrentProfile() {
    return this.profiles.getCurrent();
  }

  saveProfile(input: unknown) {
    return this.profiles.save(CandidateProfileInputSchema.parse(input));
  }
}
