import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  LogOut,
  Trash2,
  User as UserIcon,
  AlertTriangle,
  Loader2,
  CalendarDays,
  Info,
  HelpCircle,
  Camera,
  Edit2,
  Check,
  X,
  Newspaper,
  Shield,
} from "lucide-react";
import { logoutFromServer } from "../../api";
import useMe from "../../hooks/useMe";
import { useDeleteAccount, useRenameUser, useSetAvatarUrl, useUploadAvatar } from "../../hooks/useProfileMutations";
import { useUnreadUpdates } from "../../hooks/useUpdates";
import notify from "../../utils/notify";
import usePageMeta from "../../utils/usePageMeta";
import { clearSession } from "../../utils/auth";
import { resolveAvatarSrc } from "../../utils/avatar";
import MenuItem from "../components/MenuItems";
import AvatarPickerModal from "../components/AvatarPickerModal";
import AppearanceSettings from "../components/AppearanceSettings";
import AppPage from "../../components/AppPage";
import { flushPending } from "../../offline/sync";
import { countPending } from "../../offline/db";

export default function Profile() {
  usePageMeta({ title: 'Profile & settings', description: 'Manage your RemindMe profile, appearance, notifications and account.', noindex: true });
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // --- Data (see src/hooks and src/api: this page never touches axios) ---
  const me = useMe();
  const userInfo = me.data ?? null;
  const loading = me.isPending;
  const unreadUpdatesCount = useUnreadUpdates();
  const renameUser = useRenameUser();
  const setAvatarUrlOnServer = useSetAvatarUrl();
  const uploadAvatar = useUploadAvatar();
  const deleteAccount = useDeleteAccount();

  // --- Modals & Confirmation States ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // --- Profile editing ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const isUpdatingName = renameUser.isPending;
  const deleteLoading = deleteAccount.isPending;

  // --- Avatar: a local preview shows instantly while the upload runs; `undefined` means "use the saved one" ---
  const [avatarPreview, setAvatarPreview] = useState(undefined);
  const avatarUrl = avatarPreview !== undefined ? avatarPreview : userInfo?.avatar_url || null;
  const isUploadingImage = uploadAvatar.isPending || setAvatarUrlOnServer.isPending;

  // A failed profile load is reported once (a 401 is handled globally by the API client).
  useEffect(() => {
    if (me.isError && me.error?.response?.status !== 401) {
      notify.error(me.error, "Could not load your profile. Please refresh the page.");
    }
  }, [me.isError, me.error]);

  // --- Action Handlers ---

  const handleLogout = async () => {
    // Reminders changed offline live only on this device until they upload: try now, and warn if any remain.
    if (navigator.onLine) await flushPending().catch(() => {});
    const waiting = await countPending().catch(() => 0);
    if (waiting > 0) {
      const leave = window.confirm(
        `${waiting} change${waiting === 1 ? " hasn't" : "s haven't"} been uploaded yet. Logging out now will discard ${waiting === 1 ? "it" : "them"}. Log out anyway?`
      );
      if (!leave) return;
    }
    await logoutFromServer(); // revoke this device's session on the server, then clear it locally
    clearSession();
    navigate("/", { replace: true });
  };

  const handleDeleteAccount = async () => {
    if (deleteText.trim().toUpperCase() !== "DELETE") return;
    try {
      await deleteAccount.mutateAsync();
      clearSession();
      notify.success("Your account and all your data were deleted.");
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Failed to delete account:", error);
      notify.error(error, "Could not delete your account. Please try again later.");
    }
  };

  const startEditingName = () => {
    setEditNameValue(userInfo?.username || "Student");
    setIsEditingName(true);
  };

  const handleUpdateName = async () => {
    const trimmedName = editNameValue.trim();
    if (!trimmedName || trimmedName === userInfo?.username) {
      setIsEditingName(false);
      return;
    }
    try {
      await renameUser.mutateAsync(trimmedName);
      setIsEditingName(false);
      notify.success("Name updated.");
    } catch (error) {
      console.error("Failed to update name:", error);
      notify.error(error, "Could not update your name. Please try again.");
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setShowAvatarModal(false);
    const tempPreviewUrl = URL.createObjectURL(file);
    setAvatarPreview(tempPreviewUrl);

    try {
      const result = await uploadAvatar.mutateAsync(file);
      if (result?.avatar_url) notify.success("Profile picture updated.");
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      notify.error(error, "Could not upload that image. Use a picture under 2 MB.");
    } finally {
      setAvatarPreview(undefined); // the cached profile now carries the saved picture (or the old one on failure)
      URL.revokeObjectURL(tempPreviewUrl);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleIllustrationSelect = async (illustrationUrl) => {
    setShowAvatarModal(false);
    setAvatarPreview(illustrationUrl);
    try {
      await setAvatarUrlOnServer.mutateAsync(illustrationUrl);
      notify.success("Profile picture updated.");
    } catch (error) {
      console.error("Failed to update avatar illustration:", error);
      notify.error(error, "Could not set that picture. Please try again.");
    } finally {
      setAvatarPreview(undefined);
    }
  };

  // --- Render Loading Skeleton ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--rm-page)] pt-20 px-4 flex flex-col items-center">
        <div className="h-24 w-24 rounded-full bg-gray-100 animate-pulse mb-4" />
        <div className="h-6 w-32 bg-gray-100 animate-pulse rounded-lg mb-2" />
        <div className="h-4 w-48 bg-gray-100 animate-pulse rounded-lg mb-8" />
        <div className="w-full max-w-xl bg-white rounded-[2rem] h-48 animate-pulse border border-gray-100 shadow-sm" />
      </div>
    );
  }

  return (
    // <AppPage title="Profile" subtitle="Your account and preferences." backTo="/dashboard" backLabel="Dashboard" width="narrow">
    <AppPage title="Profile" subtitle="Your account and preferences." backTo="/dashboard" backLabel="Dashboard" width="narrow" centerHeader>
        {/* User Avatar & Info Header */}
        <div className="flex flex-col items-center text-center mb-10">
          <button
            type="button"
            onClick={() => !isUploadingImage && setShowAvatarModal(true)}
            disabled={isUploadingImage}
            aria-label="Change profile picture"
            className="relative h-24 w-24 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-4 shadow-sm border-2 border-white cursor-pointer group overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {avatarUrl ? (
              <img
                src={resolveAvatarSrc(avatarUrl)}
                alt="Profile Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserIcon size={36} strokeWidth={2} />
            )}

            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white mb-0.5" size={18} strokeWidth={2} />
              <span className="text-white text-[10px] font-semibold uppercase tracking-wider">Edit</span>
            </div>

            {isUploadingImage && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
                <Loader2 className="animate-spin text-blue-500" size={24} />
              </div>
            )}
          </button>

          {/* Hidden File Input */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Editable Username */}
          <div className="flex items-center justify-center h-10 mb-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateName()}
                  className="px-3 py-1.5 bg-gray-50 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 font-semibold text-lg max-w-[200px]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleUpdateName}
                  disabled={isUpdatingName}
                  className="p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors shadow-sm"
                >
                  {isUpdatingName ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(false);
                    setEditNameValue(userInfo?.username || "Student");
                  }}
                  className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="flex items-center gap-2 group cursor-pointer focus:outline-none"
                onClick={startEditingName}
              >
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  {userInfo?.username || "User"}
                </h2>
                <Edit2 size={15} className="text-gray-500 group-hover:text-blue-500 transition-colors" />
              </button>
            )}
          </div>

          <p className="text-gray-500 font-medium text-sm">{userInfo?.email}</p>

          {userInfo?.created_at && (
            <div className="flex items-center gap-1.5 mt-3 px-3.5 py-1 bg-white border border-gray-100 text-gray-500 rounded-full text-xs font-semibold shadow-sm">
              <CalendarDays size={13} strokeWidth={2} />
              <span>
                Joined{" "}
                {new Date(userInfo.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Action Menu Groups */}
        <div className="space-y-6">
          {/* General Section */}
          <div>
            <h3 className="px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">General</h3>
            <div className="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <MenuItem icon={Bell} label="Notifications" subLabel="Browser alerts, Telegram, sound and vibration" to="/notifications" />
              <MenuItem icon={Newspaper} label="Updates" to="/updates" badge={unreadUpdatesCount} />
              <MenuItem icon={HelpCircle} label="FAQs" to="/faqs" />
              <MenuItem icon={Shield} label="Legal & Privacy" to="/terms" />
              <MenuItem icon={Info} label="About App" to="/about" />
            </div>
          </div>

          {/* Appearance: dark mode + Minimalism theme toggles */}
          <AppearanceSettings />

          {/* Account Section */}
          <div>
            <h3 className="px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Account</h3>
            <div className="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              
              {/* Logout Toggle */}
              {!showLogoutConfirm ? (
                <MenuItem icon={LogOut} label="Log Out" onClick={() => setShowLogoutConfirm(true)} />
              ) : (
                <div className="p-6 bg-gray-50/50 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-sm mb-3">Log out of your account?</h3>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex-1 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors shadow-sm"
                    >
                      Yes, Log Out
                    </button>
                  </div>
                </div>
              )}

              {/* Delete Account Toggle */}
              {!showDeleteConfirm ? (
                <MenuItem
                  icon={Trash2}
                  label="Delete Account"
                  danger
                  onClick={() => setShowDeleteConfirm(true)}
                  rightElement={
                    <span className="text-[11px] font-bold text-red-500 bg-red-50 px-2.5 py-0.5 rounded-md">
                      Danger
                    </span>
                  }
                />
              ) : (
                <div className="p-6 bg-red-50/50 border-t border-red-100">
                  <div className="flex items-start gap-3 mb-5">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div>
                      <h3 className="font-bold text-red-700 text-sm">Are you absolutely sure?</h3>
                      <p className="text-xs text-red-600 font-medium mt-0.5">
                        This permanently deletes your account, reminders and profile picture. It cannot be undone.
                      </p>
                    </div>
                  </div>
                  <label htmlFor="delete-confirm" className="block text-xs font-semibold text-red-700 mb-1.5">
                    Type DELETE to confirm
                  </label>
                  <input
                    id="delete-confirm"
                    type="text"
                    value={deleteText}
                    onChange={(e) => setDeleteText(e.target.value)}
                    autoComplete="off"
                    placeholder="DELETE"
                    className="w-full mb-4 px-3 py-2.5 rounded-xl border border-red-200 bg-white text-gray-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteText("");
                      }}
                      className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading || deleteText.trim().toUpperCase() !== "DELETE"}
                      className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold flex justify-center items-center hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleteLoading ? <Loader2 size={16} className="animate-spin" /> : "Delete My Data"}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      {/* Avatar Selector Modal */}
      <AvatarPickerModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        onUploadClick={() => fileInputRef.current?.click()}
        onSelectIllustration={handleIllustrationSelect}
      />
    </AppPage>
  );
}