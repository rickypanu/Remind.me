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
  Download,
  Smartphone,
  ChevronDown,
  Share,
  CheckCircle2,
  Gift,
} from "../../components/icons";
import { logoutFromServer } from "../../api";
import useMe from "../../hooks/useMe";
import useTaskStats from "../../hooks/useTaskStats";
import { useSocial } from "../../hooks/useSocial";
import StatsStrip from "../../components/profile/StatsStrip";
import FriendsCard from "../../components/profile/FriendsCard";
import { shareStreakCard } from "../../utils/shareCard";
import { useDeleteAccount, useRenameUser, useSetAvatarUrl, useUploadAvatar } from "../../hooks/useProfileMutations";
import { useUnreadUpdates } from "../../hooks/useUpdates";
import notify from "../../utils/notify";
import { forgetLearning } from "../../utils/learning";
import usePageMeta from "../../utils/usePageMeta";
import { clearSession } from "../../utils/auth";
import { resolveAvatarSrc } from "../../utils/avatar";
import MenuItem from "../components/MenuItems";
import AvatarPickerModal from "../components/AvatarPickerModal";
import AppearanceSettings from "../components/AppearanceSettings";
import AppPage from "../../components/AppPage";
import InstallSheet from "../../components/InstallSheet";
import useInstall, { isIos, promptInstall } from "../../utils/install";
import { flushPending } from "../../offline/sync";
import { countPending } from "../../offline/db";

// Direct link to the newest Android build (GitHub Release). Keep the file name `remindme.apk` on every release.
const APK_URL = "https://github.com/rickypanu/Remind.me/releases/latest/download/remindme.apk";

const INSTALL_STEPS = [
  "Tap Download app. Your browser may say the file \"can harm your device\": tap Download anyway. It is the normal warning for apps outside the Play Store.",
  "Open the downloaded GetRemindMe.apk from the notification or your Downloads folder.",
  "If Android asks, tap Settings, switch on Allow from this source, then go back and tap Install.",
  "Open GetRemindMe, log in with the same account, and allow notifications so your reminders can ring.",
  "For alarms that never get late: allow exact alarms and set the app's battery use to Unrestricted.",
];

/**
 * "Get the app" shows BOTH ways to have GetRemindMe on a phone:
 *   1. the web app (Add to Home Screen / Install app): iPhone, Android and desktop
 *   2. the Android app (APK) with native alarms: always offered on Android and desktop, never hidden by the web app
 */
function InstallAppCard() {
  const [showSteps, setShowSteps] = useState(false);
  const [sheet, setSheet] = useState(false);
  const install = useInstall();
  const isIphone = install.ios || isIos();
  const isAndroidDevice = install.android;
  const pageUrl = typeof window !== "undefined" ? window.location.origin : "";

  const onInstall = async () => {
    if (install.canPrompt) {
      if (await promptInstall()) notify.success("Installing GetRemindMe…");
    } else {
      setSheet(true);
    }
  };

  const primaryClass =
    "flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-blue-600 text-white text-[15px] font-bold hover:bg-blue-700 active:scale-[0.99] transition shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

  return (
    <div className="mx-1 mb-8 mt-10 space-y-5 sm:mx-2">
      <h3 className="px-3 text-[11px] font-bold text-gray-600 uppercase tracking-wider -mb-1">Get the app</h3>

      {/* 1. Web app (hidden only inside the Android app itself, where it makes no sense) */}
      {!install.webview && (
        <div className="rm-ios-card bg-white border-[1.5px] border-slate-900 rounded-[24px] overflow-hidden shadow-[4px_4px_0_0_#14161f]">
          <div className="p-5 flex items-center gap-4">
            <img src="/icon-192x192.png" alt="" width="52" height="52" className="h-[52px] w-[52px] shrink-0 rounded-[14px] shadow-sm" />
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-[16px] leading-tight">Web app on your Home Screen</p>
              <p className="text-[13px] text-gray-600 font-medium mt-0.5">Works on iPhone and Android. Opens full screen, works offline.</p>
            </div>
          </div>
          <div className="px-5 pb-5">
            {install.standalone ? (
              <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-sm font-semibold text-emerald-800">
                <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden="true" />
                You are using the installed web app.
              </p>
            ) : install.ios || install.canPrompt ? (
              <button type="button" onClick={onInstall} className={primaryClass}>
                {install.ios ? <Share size={18} strokeWidth={2.5} /> : <Download size={18} strokeWidth={2.5} />}
                {install.ios ? "Add to Home Screen" : "Install web app"}
              </button>
            ) : (
              <p className="text-[13px] text-gray-700 bg-gray-50 border border-gray-100 rounded-2xl p-3.5 leading-relaxed">
                Open your browser menu (⋮ or the install icon in the address bar) and choose <strong>Install app</strong> or{" "}
                <strong>Add to Home screen</strong>.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 2. Android app (APK): exactly as before, on every device except iPhone */}
      <div className="rm-ios-card bg-white border-[1.5px] border-slate-900 rounded-[24px] overflow-hidden shadow-[4px_4px_0_0_#14161f]">
        <div className="p-5 flex items-center gap-4">
          <div className="h-[52px] w-[52px] shrink-0 rounded-[14px] bg-blue-50 text-blue-700 flex items-center justify-center">
            <Smartphone size={24} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-[16px] leading-tight">GetRemindMe for Android</p>
            <p className="text-[13px] text-gray-600 font-medium mt-0.5">Alarms that ring on your phone, even offline. Voice quick add.</p>
          </div>
        </div>

        <div className="px-5 pb-5">
          {isIphone ? (
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-xl p-3">
              The Android app is for Android phones. On iPhone, use the web app above.
            </p>
          ) : (
            <a
              href={APK_URL}
              download="GetRemindMe.apk"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-blue-600 text-white text-[15px] font-bold hover:bg-blue-700 active:scale-[0.99] transition shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <Download size={18} strokeWidth={2.5} />
              Download app (Android)
            </a>
          )}

          {!isAndroidDevice && !isIphone && pageUrl && (
            <div className="mt-4 flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${encodeURIComponent(pageUrl + "/profile")}`}
                alt="QR code to open GetRemindMe on your phone"
                width={80}
                height={80}
                loading="lazy"
                className="rounded-lg bg-white"
              />
              <p className="text-xs text-gray-700 font-medium leading-relaxed">
                On a computer? Scan this with your Android phone, log in, then open Profile and tap Download app.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowSteps((v) => !v)}
            aria-expanded={showSteps}
            className="mt-4 w-full flex items-center justify-between text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
          >
            How to install
            <ChevronDown size={16} className={`transition-transform ${showSteps ? "rotate-180" : ""}`} />
          </button>

          {showSteps && (
            <div className="mt-3">
              <ol className="space-y-2.5">
                {INSTALL_STEPS.map((text, i) => (
                  <li key={text} className="flex gap-3 text-[13px] text-gray-700 leading-relaxed">
                    <span className="h-5 w-5 shrink-0 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-gray-600 leading-relaxed">
                To update, download the new file the same way and install it over the old app. Your reminders and login are kept.
              </p>
            </div>
          )}
        </div>
      </div>
      {sheet && <InstallSheet iosSafari={install.iosSafari} onClose={() => setSheet(false)} />}
    </div>
  );
}

export default function Profile() {
  usePageMeta({ title: 'Profile & settings', description: 'Manage your GetRemindMe profile, appearance, notifications and account.', noindex: true });
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // --- Data (see src/hooks and src/api: this page never touches axios) ---
  const me = useMe();
  const userInfo = me.data ?? null;
  const loading = me.isPending;
  const unreadUpdatesCount = useUnreadUpdates();
  const stats = useTaskStats().data;
  const reward = !!useSocial().data?.reward_unlocked;
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

  const handleShareStreak = async () => {
    const result = await shareStreakCard({
      name: userInfo?.username,
      streak: stats?.streak ?? 0,
      best: stats?.best_streak ?? 0,
      doneToday: stats?.completed_today ?? 0,
    });
    if (result === "downloaded") notify.success("Streak card saved. Post it anywhere.");
    else if (result === "failed") notify.error("Could not make the streak card. Please try again.");
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
    <AppPage title="Profile" backTo="/u" backLabel="Dashboard" width="narrow" centerHeader>
        {/* Identity card: ultramarine band, avatar with a ring, name, then the streak numbers */}
        <section className="mb-8 overflow-hidden rounded-[28px] border-[1.5px] border-slate-900 bg-white shadow-[6px_6px_0_0_#14161f]">
          <div className="relative h-28 bg-blue-600">
            <span aria-hidden="true" className="absolute -right-6 -top-10 h-36 w-36 rounded-full bg-[#f4b400]" />
            <span aria-hidden="true" className="absolute right-24 top-14 h-10 w-10 rounded-full border-[3px] border-white/70" />
            <span aria-hidden="true" className="absolute left-8 top-6 h-3 w-16 rounded-full bg-white/30" />
          </div>
          <div className="px-5 pb-6 sm:px-8">
            <div className="-mt-14 flex flex-col items-center text-center sm:flex-row sm:items-end sm:gap-5 sm:text-left">
              <button
                type="button"
                onClick={() => !isUploadingImage && setShowAvatarModal(true)}
                disabled={isUploadingImage}
                aria-label="Change profile picture"
                className={`group relative h-28 w-28 shrink-0 cursor-pointer overflow-hidden rounded-full bg-blue-50 text-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  reward ? "ring-4 ring-[#f4b400]" : "ring-4 ring-white"
                } border-[1.5px] border-slate-900`}
              >
                {avatarUrl ? (
                  <img src={resolveAvatarSrc(avatarUrl)} alt="Profile Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center"><UserIcon size={40} strokeWidth={2} /></span>
                )}
                <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Camera className="mb-0.5 text-white" size={18} strokeWidth={2} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white">Edit</span>
                </span>
                {isUploadingImage && (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-blue-500" size={24} />
                  </span>
                )}
              </button>

              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />

              <div className="mt-16 min-w-0 flex-1 sm:mb-1 sm:pt-16">
                <div className="flex h-10 items-center justify-center sm:justify-start">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editNameValue}
                        onChange={(e) => setEditNameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleUpdateName()}
                        aria-label="Your name"
                        className="max-w-[200px] rounded-xl border border-blue-200 bg-gray-50 px-3 py-1.5 text-lg font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        autoFocus
                      />
                      <button type="button" onClick={handleUpdateName} disabled={isUpdatingName} aria-label="Save name" className="rounded-xl bg-blue-600 p-2 text-white shadow-sm hover:bg-blue-700">
                        {isUpdatingName ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
                      </button>
                      <button type="button" aria-label="Cancel" onClick={() => { setIsEditingName(false); setEditNameValue(userInfo?.username || "Student"); }} className="rounded-xl bg-gray-100 p-2 text-gray-600 hover:bg-gray-200">
                        <X size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="group flex items-center gap-2 focus:outline-none" onClick={startEditingName} aria-label="Edit your name">
                      <h2 className="truncate text-3xl font-extrabold tracking-tight text-gray-900">{userInfo?.username || "User"}</h2>
                      <Edit2 size={15} className="text-gray-500 transition-colors group-hover:text-blue-600" />
                    </button>
                  )}
                </div>
                <p className="mt-1 truncate text-sm font-medium text-gray-500">{userInfo?.email}</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {userInfo?.created_at && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                      <CalendarDays size={13} strokeWidth={2} />
                      Joined {new Date(userInfo.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </span>
                  )}
                  {reward && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4b400] px-3 py-1 text-xs font-extrabold text-[#14161f]">
                      <Gift size={13} strokeWidth={2.4} /> Connector
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <StatsStrip stats={stats} />
              <button
                type="button"
                onClick={handleShareStreak}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-slate-900 bg-[#f4b400] py-3.5 text-[15px] font-extrabold text-[#14161f] shadow-[3px_3px_0_0_#14161f] transition active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <Share size={18} strokeWidth={2.4} /> Share my streak
              </button>
            </div>
          </div>
        </section>

        {/* Action Menu Groups */}
        <div className="space-y-6">
          {/* General Section */}
          <div>
            <h3 className="px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">General</h3>
            <div className="bg-white border-[1.5px] border-slate-900 rounded-[24px] overflow-hidden shadow-[4px_4px_0_0_#14161f]">
              <MenuItem icon={Bell} label="Notifications" subLabel="Browser alerts, Telegram, sound and vibration" to="/notifications" />
              <MenuItem icon={Newspaper} label="Updates" to="/updates" badge={unreadUpdatesCount} />
              <MenuItem icon={HelpCircle} label="FAQs" to="/faqs" />
              <MenuItem icon={Shield} label="Legal & Privacy" to="/terms" />
              <MenuItem icon={Info} label="About App" to="/about" />
            </div>
          </div>

          <FriendsCard myName={userInfo?.username} />

          {/* Install on the Home screen (iPhone, Android, desktop) + Android APK */}
          <InstallAppCard />

          {/* Appearance: dark mode + Minimalism theme toggles */}
          <AppearanceSettings />

          {/* Quick add: what it learned from the person's own category choices (stored on this device only) */}
          <div>
            <h3 className="px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Quick add</h3>
            <div className="bg-white border-[1.5px] border-slate-900 rounded-[24px] p-4 shadow-[4px_4px_0_0_#14161f] flex items-center justify-between gap-4">
              <div className="text-left">
                <p className="font-medium text-gray-900">Forget what quick add learned</p>
                <p className="text-xs text-gray-500 mt-0.5">It learns on this device only which category you pick. Your reminders stay as they are.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  forgetLearning();
                  notify.success("Quick add has forgotten your category choices.");
                }}
                className="shrink-0 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Forget
              </button>
            </div>
          </div>

          {/* Account Section */}
          <div>
            <h3 className="px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Account</h3>
            <div className="bg-white border-[1.5px] border-slate-900 rounded-[24px] overflow-hidden shadow-[4px_4px_0_0_#14161f]">
              
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