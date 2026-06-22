"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  UploadIcon,
  FilesIcon,
  FilePlusIcon,
  Loader2Icon,
} from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slug";
import dynamic from "next/dynamic";
import { FileTree } from "@/components/projects/file-tree";
import { MarkdownEditor } from "@/components/projects/markdown-editor";
import { AddFileDialog } from "@/components/projects/add-file-dialog";

// react-pdf (inside FilePreview) uses browser-only globals at module eval, so
// load it client-side only to keep it out of server render.
const FilePreview = dynamic(
  () => import("@/components/files/file-preview").then((m) => m.FilePreview),
  { ssr: false }
);
import { ChatHistory } from "@/components/projects/chat-history";
import { ChatPanel } from "@/components/ai/chat-panel";
import { SetPageBreadcrumb } from "@/components/breadcrumb-context";
import { useAiContext } from "@/lib/ai/use-ai-context";
import type { Conversation } from "@/lib/ai/conversations";
import {
  addFilesToFolder,
  createDoc,
  getDoc,
  getDownloadUrl,
  renameFile,
  renameFolder,
  saveDoc,
  uploadFiles,
} from "@/lib/files/actions";
import type { KBFile, RepoFolder } from "@/lib/kb/types";

interface FolderWorkspaceProps {
  folderId: string;
  projectName: string;
  initialFiles: KBFile[];
  filesRoot: RepoFolder;
}

/** Markdown / note docs are edited inline; everything else previews. */
function isEditable(file: KBFile | null): boolean {
  return file?.type === "md" || file?.type === "note";
}

export function FolderWorkspace({
  folderId,
  projectName,
  initialFiles,
  filesRoot,
}: FolderWorkspaceProps) {
  const router = useRouter();
  const [files, setFiles] = useState<KBFile[]>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<KBFile | null>(
    initialFiles[0] ?? null
  );
  const [content, setContent] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const diskInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setAiSelection = useAiContext((s) => s.setSelection);

  // Active project chat: parent owns the id so the history list can highlight
  // it even before the first save. New chat → fresh id, no rehydrated messages.
  const [chatId, setChatId] = useState<string>(() => crypto.randomUUID());
  const [chatMessages, setChatMessages] = useState<Conversation["messages"] | undefined>(undefined);
  const [historyToken, setHistoryToken] = useState(0);

  const handleNewChat = useCallback(() => {
    setChatId(crypto.randomUUID());
    setChatMessages(undefined);
  }, []);

  const handleSelectChat = useCallback((conversation: Conversation) => {
    setChatId(conversation.id);
    setChatMessages(conversation.messages);
  }, []);

  // A save created/updated a row — refresh the project's history list, and pull
  // any files Archon authored this turn (e.g. via create_document) into the tree.
  // Stable identity so the chat panel's save effect doesn't loop.
  const handleChatSaved = useCallback(() => {
    setHistoryToken((t) => t + 1);
    router.refresh();
  }, [router]);

  const existingIds = useMemo(() => new Set(files.map((f) => f.id)), [files]);

  // Reconcile the file list with the server after uploads / adds.
  useEffect(() => {
    setFiles(initialFiles);
    setSelectedFile((prev) =>
      prev && initialFiles.some((f) => f.id === prev.id)
        ? prev
        : initialFiles[0] ?? null
    );
  }, [initialFiles]);

  // Load the selected file: inline body for docs, a signed URL for binaries.
  useEffect(() => {
    if (!selectedFile) {
      setContent("");
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    setLoadingContent(true);
    const load = isEditable(selectedFile)
      ? getDoc(selectedFile.id).then((doc) => {
          if (!cancelled) {
            setContent(doc?.content ?? "");
            setPreviewUrl(null);
          }
        })
      : getDownloadUrl(selectedFile.id).then((url) => {
          if (!cancelled) {
            setPreviewUrl(url);
            setContent("");
          }
        });
    load
      .catch((error) => console.error("Failed to load file", error))
      .finally(() => {
        if (!cancelled) setLoadingContent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  // Publish the active file (or the project folder) so the Archon drawer knows
  // what the user is looking at. Cleared when the workspace unmounts.
  useEffect(() => {
    setAiSelection(
      selectedFile
        ? {
            kind: "file",
            id: selectedFile.id,
            name: selectedFile.name,
            fileType: selectedFile.type,
          }
        : { kind: "folder", id: folderId, name: projectName }
    );
  }, [selectedFile, folderId, projectName, setAiSelection]);

  useEffect(() => () => setAiSelection(null), [setAiSelection]);

  const handleRenameFile = useCallback(
    (fileId: string, name: string) => {
      startTransition(async () => {
        try {
          await renameFile(fileId, name);
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, name } : f))
          );
          setSelectedFile((prev) =>
            prev && prev.id === fileId ? { ...prev, name } : prev
          );
          router.refresh();
        } catch (error) {
          console.error("Failed to rename file", error);
        }
      });
    },
    [router]
  );

  function handleEditorChange(html: string) {
    if (!selectedFile) return;
    const id = selectedFile.id;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDoc(id, html).catch((error) =>
        console.error("Failed to save doc", error)
      );
    }, 800);
  }

  function handleRenameProject(newName: string) {
    startTransition(async () => {
      try {
        await renameFolder(folderId, newName);
        // The URL is the project slug — move to the new one.
        router.replace(`/projects/${slugify(newName)}`);
      } catch (error) {
        console.error("Failed to rename project", error);
      }
    });
  }

  function handleNewNote() {
    startTransition(async () => {
      try {
        const { id } = await createDoc(folderId, "Untitled.md");
        const note: KBFile = {
          id,
          name: "Untitled.md",
          path: "Untitled.md",
          type: "md",
          folder_id: folderId,
        };
        setFiles((prev) => [note, ...prev]);
        setSelectedFile(note);
        router.refresh();
      } catch (error) {
        console.error("Failed to create note", error);
      }
    });
  }

  function handleUploadDevice(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;
    const formData = new FormData();
    selected.forEach((file) => formData.append("files", file));
    setUploadingNames(selected.map((f) => f.name));
    startTransition(async () => {
      try {
        await uploadFiles(folderId, formData);
        router.refresh();
      } catch (error) {
        console.error("Upload failed", error);
      } finally {
        setUploadingNames([]);
      }
    });
  }

  function handleAddFromFiles(added: KBFile[]) {
    const ids = added.map((f) => f.id).filter((id) => !existingIds.has(id));
    if (ids.length === 0) return;
    startTransition(async () => {
      try {
        await addFilesToFolder(folderId, ids);
        router.refresh();
      } catch (error) {
        console.error("Failed to add files", error);
      }
    });
  }

  return (
    <DndProvider backend={HTML5Backend}>
      {/* Project name shows in the topbar breadcrumb; click it there to rename. */}
      <SetPageBreadcrumb label={projectName} onRename={handleRenameProject} />

      <Group
        orientation="horizontal"
        className="flex min-h-0 flex-1 overflow-hidden bg-background"
      >
        {/* Left — file tree */}
        <Panel defaultSize="20%" minSize="180px" className="min-w-0">
          <div className="flex h-full min-h-0 flex-col bg-background-surface">
            <div className="relative shrink-0 border-b border-border p-2">
              <button
                type="button"
                aria-label="Add file"
                onClick={() => setMenuOpen((o) => !o)}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-md px-3 py-2",
                  "ty-body-2 font-medium text-white transition-colors",
                  "bg-neutral-900 hover:bg-neutral-800"
                )}
              >
                <PlusIcon className="size-4" />
                Add file
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute inset-x-2 z-20 mt-1 overflow-hidden rounded-md border border-border bg-background-surface py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        diskInputRef.current?.click();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left ty-body-2 text-primary-text hover:bg-background-subtle"
                    >
                      <UploadIcon className="size-4 text-tertiary-text" />
                      Upload from device
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setAddOpen(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left ty-body-2 text-primary-text hover:bg-background-subtle"
                    >
                      <FilesIcon className="size-4 text-tertiary-text" />
                      Add from files
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleNewNote();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left ty-body-2 text-primary-text hover:bg-background-subtle"
                    >
                      <FilePlusIcon className="size-4 text-tertiary-text" />
                      New note
                    </button>
                  </div>
                </>
              )}
            </div>
            {/* Files + chat history share one scroller so the history sits
                immediately below the last file rather than pinned to the bottom. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="p-2">
                {uploadingNames.map((name, i) => (
                  <div
                    key={`uploading-${i}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 ty-body-2 text-tertiary-text"
                  >
                    <Loader2Icon className="size-4 shrink-0 animate-spin" />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
                <FileTree
                  nodes={[]}
                  rootFiles={files}
                  selectedFileId={selectedFile?.id ?? null}
                  onSelectFile={setSelectedFile}
                />
              </div>

              {/* Project chat history — every Archon chat in this project. */}
              <ChatHistory
                folderId={folderId}
                activeId={chatId}
                refreshToken={historyToken}
                onSelect={handleSelectChat}
                onNewChat={handleNewChat}
              />
            </div>
          </div>
        </Panel>

        <PanelDivider />

        {/* Middle — editor (docs) or embedded preview (everything else) */}
        <Panel defaultSize="52%" minSize="320px" className="min-w-0">
          <div className="flex h-full min-h-0 flex-col bg-background">
            {!selectedFile ? (
              <Centered>Select a file to start editing.</Centered>
            ) : loadingContent ? (
              <Centered>Loading…</Centered>
            ) : isEditable(selectedFile) ? (
              <MarkdownEditor
                key={selectedFile.id}
                fileId={selectedFile.id}
                initialContent={content}
                onChange={handleEditorChange}
                title={selectedFile.name}
                onRenameTitle={(name) =>
                  handleRenameFile(selectedFile.id, name)
                }
              />
            ) : previewUrl ? (
              <FilePreview
                key={selectedFile.id}
                url={previewUrl}
                type={selectedFile.type}
                name={selectedFile.name}
              />
            ) : (
              <Centered>No preview available for this file.</Centered>
            )}
          </div>
        </Panel>

        <PanelDivider />

        {/* Right — AI chat (scoped to this project) */}
        <Panel defaultSize="28%" minSize="280px" className="min-w-0">
          <ChatPanel
            key={chatId}
            folderId={folderId}
            projectName={projectName}
            conversationId={chatId}
            initialMessages={chatMessages}
            onSaved={handleChatSaved}
          />
        </Panel>
      </Group>

      <input
        ref={diskInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUploadDevice}
      />

      <AddFileDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        root={filesRoot}
        existingIds={existingIds}
        onAdd={handleAddFromFiles}
      />
    </DndProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="ty-body-2 text-tertiary-text">{children}</p>
    </div>
  );
}

function PanelDivider() {
  return (
    <Separator
      className={cn(
        "w-1 shrink-0 cursor-col-resize bg-border/60 transition-colors",
        "hover:bg-data-accent/50 data-[state=dragging]:bg-data-accent/70"
      )}
    />
  );
}
