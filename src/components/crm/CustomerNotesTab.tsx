import { useState } from "react";
import { Pin, Trash2, Plus, Search, Tag, Sparkles, User, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CustomerNote } from "@/services/crm/crmTypes";
import { crmService } from "@/services/crm/crmService";

interface CustomerNotesTabProps {
  customerId: string;
  notes: CustomerNote[];
  currentUserName?: string;
  onNotesUpdated: (newNotes: CustomerNote[]) => void;
}

const QUICK_TAGS = [
  "Family Wedding",
  "VIP Client",
  "Call After 6 PM",
  "Dislikes Heavy Zari",
  "Occasion Shopping",
  "Alteration Nuance",
  "Prefers Video Call",
  "Budget Focused",
];

export function CustomerNotesTab({
  customerId,
  notes,
  currentUserName = "Staff",
  onNotesUpdated,
}: CustomerNotesTabProps) {
  const [noteText, setNoteText] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddNote = () => {
    if (!noteText.trim()) {
      toast.error("Please enter a note before saving");
      return;
    }

    setAdding(true);
    try {
      crmService.addNote(customerId, noteText, currentUserName, selectedTags, isPinned);
      const updated = crmService.getNotes(customerId);
      onNotesUpdated(updated);
      setNoteText("");
      setSelectedTags([]);
      setIsPinned(false);
      toast.success("Relationship note added to customer 360");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add note");
    } finally {
      setAdding(false);
    }
  };

  const handleTogglePin = (noteId: string) => {
    const updated = crmService.togglePinNote(customerId, noteId);
    onNotesUpdated(updated);
    toast.success("Note pin status updated");
  };

  const handleDelete = (noteId: string) => {
    const updated = crmService.deleteNote(customerId, noteId);
    onNotesUpdated(updated);
    toast.success("Note removed");
  };

  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.note.toLowerCase().includes(q) ||
      n.authorName.toLowerCase().includes(q) ||
      n.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-6">
      {/* ================= Note Composer ================= */}
      <Card className="border shadow-xs bg-slate-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            Add Relationship & Clienteling Note
          </CardTitle>
          <CardDescription className="text-xs">
            Log memorable details, family events, styling quirks, or communication boundaries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="e.g. Customer loved the mulberry silk swatch. Daughter's sangeet is on Dec 14th; promised to call back with blouse embroidery options."
            rows={3}
            className="text-xs bg-white resize-none"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />

          {/* Quick Tags Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              Quick Tags:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-purple-100 border-purple-300 text-purple-800 font-semibold"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
              <Checkbox
                checked={isPinned}
                onCheckedChange={(checked) => setIsPinned(Boolean(checked))}
              />
              <span className="flex items-center gap-1">
                <Pin className="h-3.5 w-3.5 text-purple-600" /> Pin note to Customer 360 overview
              </span>
            </label>

            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={adding || !noteText.trim()}
              className="bg-primary hover:bg-primary/90 text-xs font-semibold gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              {adding ? "Adding…" : "Save Note"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ================= Notes Feed Header & Search ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            Note History ({notes.length})
          </h4>
          <p className="text-xs text-slate-500">
            Chronological log of staff clienteling observations
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <Input
            placeholder="Search notes & tags…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>
      </div>

      {/* ================= Notes List ================= */}
      <div className="space-y-3">
        {sortedNotes.length > 0 ? (
          sortedNotes.map((note) => (
            <Card
              key={note.id}
              className={`border transition-all ${
                note.isPinned
                  ? "border-purple-200 bg-purple-50/20 shadow-xs ring-1 ring-purple-100"
                  : "bg-white shadow-xs"
              }`}
            >
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    {note.isPinned && (
                      <Badge
                        variant="outline"
                        className="bg-purple-100 text-purple-800 border-purple-300 text-[10px] font-bold uppercase gap-1"
                      >
                        <Pin className="h-2.5 w-2.5 fill-purple-600" /> Pinned Note
                      </Badge>
                    )}
                    <p className="text-xs md:text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">
                      {note.note}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 ${
                        note.isPinned ? "text-purple-600 hover:text-purple-700" : "text-slate-400 hover:text-slate-600"
                      }`}
                      title={note.isPinned ? "Unpin note" : "Pin note to top"}
                      onClick={() => handleTogglePin(note.id)}
                    >
                      <Pin className={`h-3.5 w-3.5 ${note.isPinned ? "fill-purple-600" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-rose-600"
                      title="Delete note"
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Tags if any */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {note.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] px-2 py-0 bg-slate-100 text-slate-700">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Footer metadata */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> Logged by <strong className="text-slate-600 font-medium">{note.authorName}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {new Date(note.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-12 text-center text-xs text-slate-500 border border-dashed rounded-xl bg-slate-50">
            <p>No notes found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
