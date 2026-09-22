import { useChatStore } from "../store/useChatStore";
import { useRef, useState, useEffect, lazy, Suspense } from "react";

import BorderAnimatedContainer from "../components/BorderAnimatedContainer";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import SearchBar from "../components/SearchBar";
import ChatsList from "../components/ChatsList";
import ContactList from "../components/ContactList";
import SidebarBottom from "../components/SidebarBottom";
import NotificationCenter from "../components/NotificationCenter";
import ChatContainer from "../components/ChatContainer";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";
import usePremiumStore from "../store/usePremiumStore";
import { MenuIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";

const SearchOverlay = lazy(() => import("../components/SearchOverlay"));
const AIAssistantPanel = lazy(() => import("../components/AIAssistantPanel"));
const MyProfilePanel = lazy(() => import("../components/MyProfilePanel"));
const QuickViewPanel = lazy(() => import("../components/QuickViewPanel"));
const CreateGroupModal = lazy(() => import("../components/CreateGroupModal"));
const GroupInfoPanel = lazy(() => import("../components/GroupInfoPanel"));
const UpgradeModal = lazy(() => import("../components/UpgradeModal"));
const PlanManagerModal = lazy(() => import("../components/PlanManagerModal"));
const StorageManagerModal = lazy(() => import("../components/StorageManagerModal"));
const HDCallsModal = lazy(() => import("../components/HDCallsModal"));
const ThemeMarketplace = lazy(() => import("../components/ThemeMarketplace"));

function ChatPage({ theme, setTheme }) {
    const {
      activeTab,
      selectedUser,
      selectedGroup,
      setActiveTab,
      setSelectedUser,
      setSelectedGroup,
      subscribeToMessages,
      unsubscribeFromMessages,
      getMyChatPartners,
      isCreateGroupOpen,
      isGroupInfoOpen,
      openCreateGroup,
      openGroupInfo,
      closeCreateGroup,
      closeGroupInfo,
    } = useChatStore();
   const [myProfileOpen, setMyProfileOpen] = useState(false);
   const searchBarRef = useRef(null);
   const [searchTerm, setSearchTerm] = useState("");
   const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
   const [quickSection, setQuickSection] = useState(null);
    const [isStorageOpen, setIsStorageOpen] = useState(false);
    const [isCallsOpen, setIsCallsOpen] = useState(false);
    const [isThemesOpen, setIsThemesOpen] = useState(false);
    const [detailsTrigger, setDetailsTrigger] = useState(0);
    const [detailsPanel, setDetailsPanel] = useState(null);
    const [aiDefaultTool, setAiDefaultTool] = useState(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Vyntra Pro modal open-state lives in the premium store so every entry point
  // (sidebar card, premium-gating prompt, custom event) shares one source of truth.
  const isUpgradeOpen = usePremiumStore((s) => s.isUpgradeOpen);
  const isPlanOpen = usePremiumStore((s) => s.isPlanOpen);
  const openUpgradeModal = usePremiumStore((s) => s.openUpgradeModal);
  const closeUpgradeModal = usePremiumStore((s) => s.closeUpgradeModal);
  const openPlanModal = usePremiumStore((s) => s.openPlanModal);
  const closePlanModal = usePremiumStore((s) => s.closePlanModal);

  // Global listener: premium-gated features (themes, AI) dispatch this event
  // to open the upgrade modal for free users.
  useEffect(() => {
    const handleOpenUpgrade = () => openUpgradeModal();
    window.addEventListener("open-upgrade-modal", handleOpenUpgrade);
    return () => window.removeEventListener("open-upgrade-modal", handleOpenUpgrade);
  }, [openUpgradeModal]);

  // Global search shortcut: Ctrl+K (Windows/Linux) or Cmd+K (macOS).
  // Registered exactly once at the ChatPage level so it works even when the
  // sidebar search input is not mounted (mobile). Desktop focuses the inline
  // SearchBar; all screens also open the unified SearchOverlay.
  useEffect(() => {
    const onKeyDown = (e) => {
      const isShortcut =
        (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "k" || e.key === "K");
      if (isShortcut) {
        e.preventDefault();
        setIsSearchOverlayOpen(true);
        searchBarRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Global realtime subscription â€” active for the whole session, so unread
  // badges, typing indicators and read receipts stay live for every chat.
        useEffect(() => {
    subscribeToMessages();
    getMyChatPartners();
    // Cleanup: tear down all socket event listeners when the page unmounts so
    // we never leak handlers or update state on an unmounted store.
    return () => unsubscribeFromMessages();
  }, [subscribeToMessages, unsubscribeFromMessages, getMyChatPartners]);
  const [isAIOpen, setIsAIOpen] = useState(
    () => localStorage.getItem("aiAssistantOpen") === "true"
  );
  // Shared ref so the AI panel can insert suggested text into MessageInput.
  const insertTextRef = useRef(null);

const toggleAI = (force) =>
    setIsAIOpen((prev) => {
      const next = typeof force === "boolean" ? force : !prev;
      localStorage.setItem("aiAssistantOpen", String(next));
      return next;
    });

    const openAI = () => {
    setActiveTab("chats");
    setIsAIOpen(true);
    window.dispatchEvent(new CustomEvent("open-ai-assistant"));
  };

  // Open the AI Assistant from the AI History empty state. Reuses the existing
  // AI Assistant surface/state instead of fabricating a history.
  const startAIFromHistory = () => {
    setQuickSection(null);
    if (!isAIOpen) {
      setActiveTab("chats");
      setIsAIOpen(true);
      window.dispatchEvent(new CustomEvent("open-ai-assistant"));
    }
  };

  // Open a conversation from the quick-view library panel (Pinned/Favorites/Files).
  const openConversationFromQuick = (user) => {
    setSelectedUser(user);
    setActiveTab("chats");
    setQuickSection(null);
  };

  // Vyntra Pro feature launchers (called from UpgradeModal)
  const openProAI = () => {
    closeUpgradeModal();
    toggleAI(true);
  };
  const openProStorage = () => {
    closeUpgradeModal();
    setIsStorageOpen(true);
  };
  const openProCalls = () => {
    closeUpgradeModal();
    setIsCallsOpen(true);
  };
  const openProThemes = () => {
    closeUpgradeModal();
    setIsThemesOpen(true);
  };
  const handleOpenThemes = (key) => {
    setTheme(key);
    setIsThemesOpen(false);
  };
    const handleManageFiles = () => {
    setIsStorageOpen(false);
    setQuickSection("files");
  };

  const handlePlanFeature = (launcher) => {
    closePlanModal();
    if (!usePremiumStore.getState().isPro) {
      openUpgradeModal();
    } else {
      launcher();
    }
  };

  const onOpenSummary = () => handlePlanFeature(() => {
    if (selectedUser || selectedGroup) {
      setDetailsPanel("ai");
      setDetailsTrigger((t) => t + 1);
    } else {
      toast("Open a conversation first to view AI summary.", { icon: "✨" });
    }
  });

  const onOpenTranslate = () => handlePlanFeature(() => {
    setActiveTab("chats");
    setAiDefaultTool("translate");
    setIsAIOpen(true);
  });

  const onOpenSmartReply = () => handlePlanFeature(() => {
    setActiveTab("chats");
    setAiDefaultTool("smart");
    setIsAIOpen(true);
  });

  const onOpenMeetingNotes = () => handlePlanFeature(() => {
    setActiveTab("chats");
    setAiDefaultTool("meeting");
    setIsAIOpen(true);
  });

  const onOpenAdvancedAI = () => handlePlanFeature(() => {
    setActiveTab("chats");
    setAiDefaultTool(null);
    setIsAIOpen(true);
  });

  const onOpenStorage = () => handlePlanFeature(() => {
    setIsStorageOpen(true);
  });

  const onOpenCalls = () => handlePlanFeature(() => {
    setIsCallsOpen(true);
  });

  const onOpenThemes = () => handlePlanFeature(() => {
    setIsThemesOpen(true);
  });

  const onOpenAnalytics = () => handlePlanFeature(() => {
    if (selectedUser || selectedGroup) {
      setDetailsPanel("analytics");
      setDetailsTrigger((t) => t + 1);
    } else {
      toast("Open a conversation first to view analytics.", { icon: "📊" });
    }
  });

  const onOpenWidgets = () => handlePlanFeature(() => {
    if (selectedUser || selectedGroup) {
      setDetailsPanel("widgets");
      setDetailsTrigger((t) => t + 1);
    } else {
      toast("Open a conversation first to view widgets.", { icon: "🧩" });
    }
  });

  // After a group is created via CreateGroupModal, switch the main pane into it.
  const handleGroupCreated = (group) => {
    if (group?._id) {
      setSelectedGroup(group);
      setQuickSection(null);
    }
  };

  return (
    <div className="relative flex h-full w-full items-stretch justify-center overflow-hidden">
      {/* Premium sidebar — rendered outside BorderAnimatedContainer so its z-index
          can escape the stacking context created by backdrop-filter and remain
          above the QuickViewPanel backdrop. */}
      <div className={`fixed inset-y-0 left-0 z-[90] h-full w-[300px] min-w-[300px] max-w-[300px] shrink-0 flex flex-col border-r border-white/[0.08] bg-[color:var(--panel-strong)]/95 backdrop-blur-xl transition-transform duration-300 md:relative md:flex md:translate-x-0 ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex-shrink-0">
          <ProfileHeader
            theme={theme}
            setTheme={setTheme}
            onOpenMyProfile={() => { setMyProfileOpen(true); setIsMobileSidebarOpen(false); }}
          />
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 px-4 pt-3 pb-1.5">
           <div className="min-w-0 flex-1">
             <SearchBar
               ref={searchBarRef}
               value={searchTerm}
               onChange={setSearchTerm}
               onClear={() => setSearchTerm("")}
               placeholder={activeTab === "chats" ? "Search chats…" : "Search contacts or enter a phone number…"}
             />
           </div>
           <NotificationCenter />
         </div>
        <div className="flex-shrink-0 px-4 pb-2">
          <ActiveTabSwitch onAI={openAI} />
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4">
          {activeTab === "chats" ? (
            <ChatsList
              filter={searchTerm}
              onSelect={(chat) => {
                setSelectedUser(chat);
                setActiveTab("chats");
                setIsMobileSidebarOpen(false);
              }}
            />
          ) : (
            <ContactList
              filter={searchTerm}
              onSelect={(contact) => {
                setSelectedUser(contact);
                setActiveTab("chats");
                setIsMobileSidebarOpen(false);
              }}
            />
          )}
        </div>

        <div className="flex-shrink-0">
          <SidebarBottom
            activeQuick={quickSection}
            onQuickSection={setQuickSection}
            onUpgradeNow={openUpgradeModal}
            onManagePlan={openPlanModal}
          />
        </div>
      </div>

      <BorderAnimatedContainer className="flex-1 min-w-0">
        <div className="relative flex h-full min-h-0 w-full overflow-hidden md:flex-row">
          {/* Mobile sidebar overlay */}
          {isMobileSidebarOpen && (
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
          )}
          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileSidebarOpen((v) => !v)}
            className="absolute left-3 top-3 z-50 flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] backdrop-blur-xl md:hidden"
            aria-label="Toggle menu"
          >
            {isMobileSidebarOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
          </button>
           <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[color:var(--panel)]/80 backdrop-blur-xl">
             {selectedUser || selectedGroup ? (
                <ChatContainer onToggleAI={toggleAI} isAIOpen={isAIOpen} insertTextRef={insertTextRef} detailsTrigger={detailsTrigger} detailsPanel={detailsPanel} onViewGroupInfo={openGroupInfo} />
             ) : (
               <NoConversationPlaceholder />
             )}
           </div>
        </div>
      </BorderAnimatedContainer>

      {/* Global overlays â€” rendered OUTSIDE BorderAnimatedContainer so their
          position: fixed is relative to the viewport, not the glass container. */}
      <Suspense fallback={null}>
        <AIAssistantPanel isOpen={isAIOpen} onClose={() => { setIsAIOpen(false); setAiDefaultTool(null); }} insertTextRef={insertTextRef} defaultTool={aiDefaultTool} />
      </Suspense>
      <Suspense fallback={null}>
        <MyProfilePanel
          isOpen={myProfileOpen}
          onClose={() => setMyProfileOpen(false)}
          theme={theme}
          setTheme={setTheme}
        />
      </Suspense>
      <Suspense fallback={null}>
        <QuickViewPanel
          isOpen={!!quickSection}
          section={quickSection}
          onClose={() => setQuickSection(null)}
          onOpenConversation={openConversationFromQuick}
          onOpenAIAssistant={startAIFromHistory}
          onCreateGroup={openCreateGroup}
        />
      </Suspense>
      <Suspense fallback={null}>
        <CreateGroupModal
          isOpen={isCreateGroupOpen}
          onClose={closeCreateGroup}
          onCreated={handleGroupCreated}
        />
      </Suspense>
      <Suspense fallback={null}>
        <GroupInfoPanel
          isOpen={isGroupInfoOpen}
          onClose={closeGroupInfo}
        />
      </Suspense>
      <Suspense fallback={null}>
        <StorageManagerModal
          isOpen={isStorageOpen}
          onClose={() => setIsStorageOpen(false)}
          onManageFiles={handleManageFiles}
        />
      </Suspense>
      <Suspense fallback={null}>
        <HDCallsModal isOpen={isCallsOpen} onClose={() => setIsCallsOpen(false)} />
      </Suspense>
      <Suspense fallback={null}>
        <ThemeMarketplace
          isOpen={isThemesOpen}
          onClose={() => setIsThemesOpen(false)}
          currentTheme={theme}
          onApply={handleOpenThemes}
        />
      </Suspense>
      <Suspense fallback={null}>
        <SearchOverlay
          isOpen={isSearchOverlayOpen}
          onClose={() => setIsSearchOverlayOpen(false)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <UpgradeModal
          isOpen={isUpgradeOpen}
          onClose={closeUpgradeModal}
          onOpenAI={openProAI}
          onOpenStorage={openProStorage}
          onOpenCalls={openProCalls}
          onOpenThemes={openProThemes}
        />
      </Suspense>
      <Suspense fallback={null}>
        <PlanManagerModal
          isOpen={isPlanOpen}
          onClose={closePlanModal}
          onOpenSummary={onOpenSummary}
          onOpenTranslate={onOpenTranslate}
          onOpenSmartReply={onOpenSmartReply}
          onOpenMeetingNotes={onOpenMeetingNotes}
          onOpenAdvancedAI={onOpenAdvancedAI}
          onOpenStorage={onOpenStorage}
          onOpenCalls={onOpenCalls}
          onOpenThemes={onOpenThemes}
          onOpenAnalytics={onOpenAnalytics}
          onOpenWidgets={onOpenWidgets}
        />
      </Suspense>
    </div>
  );
}
export default ChatPage;


