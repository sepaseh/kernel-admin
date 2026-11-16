export type ChangePasswordParams = {
  currentPassword: string;
  newPassword: string;
};

export type OtpRequestProps = {
  expiresIn: number;
  remainingSeconds: number;
};

export type LoginParams = {
  mobile: string;
  password: string;
};

export type ForgotPasswordParams = {
  mobile: string;
  otp: string;
  password: string;
};

export type RegisterParams = ForgotPasswordParams & {
  firstName: string;
  lastName: string;
};

export type OtpRequestParams = {
  mobile: string;
  purpose: "forgot_password" | "login" | "register" | "verify_email";
};
