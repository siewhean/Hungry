import { validatePassword, validateRequired } from "./validation";

/** Explicit adapters prevent RHF's form-values argument becoming label/minLength. */
export const changePasswordValidation = {
  currentPassword: { validate: (value: string) => validateRequired(value, "Current password") },
  newPassword: { validate: (value: string) => validatePassword(value) },
};
