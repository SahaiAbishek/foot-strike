export type Role = 'athlete' | 'coach' | null;

export interface AuthUser {
  email: string;
  name: string;
  pictureUrl: string | null;
  role: Role;
}
