export type StaffRole = 'admin';

export interface UserDoc {
  staffRole?: StaffRole;
  authoredUniverseCount: number;
  createdAt: number;
  updatedAt?: number;
}

export type StoredUserDoc = UserDoc;
