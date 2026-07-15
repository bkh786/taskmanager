import { ChangePasswordForm } from "./change-password-form";

export default function AccountPage() {
  return (
    <div>
      <div className="text-[22px] font-bold text-text-main mb-0.5">Account</div>
      <div className="text-[13.5px] text-text-sub mb-5">
        Change your password. Other profile fields are managed by your admin.
      </div>
      <ChangePasswordForm />
    </div>
  );
}
