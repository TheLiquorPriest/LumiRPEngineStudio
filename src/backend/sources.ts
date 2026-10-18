// What a draft's assistant reads: a chat's transcript, its character cards, the lore books that
// apply (the chat's, its characters', the active persona's and the global ones, or books picked
// by hand) and text the user pasted. Everything is read live through the host, as the user, and a
// chat is read only after the host has said it is theirs. LumiRPEngine's own books hold the
// engine's sections, not lore, so they're left out.

import { isRecord } from "../shared/json";
import type { BookRef, DraftSource } from "../shared/protocol";
import type { HostBookEntry, HostCharacter, HostChat, HostMessage, StudioHost } from "./host";

/** The characters a chat is with: a group chat's members, else its one character. */
export function chatCharacterIds(chat: HostChat): string[] {
  const ids = chat.metadata.group === true && Array.isArray(chat.metadata.character_ids) ? chat.metadata.character_ids.filter((id): id is string => typeof id === "string" && id !== "") : [];
  return ids.length > 0 ? [...new Set(ids)] : chat.characterId ? [chat.characterId] : [];
}

/** Whether a book's metadata marks one LumiRPEngine made for its sections ("LumiRPEngine · <world>"). */
export function isEngineBook(metadata: unknown): boolean {
  return isRecord(metadata) && metadata.lumi_rp_engine === true;
}

/**
 * The lore books that apply to a chat or characters, as the host gathers World Info: the chat's
 * own, each character's, the active persona's and the global ones, each named once, under the
 * first scope that brings it in.
 */
export async function booksFor(host: StudioHost, userId: string, chat: HostChat | null, characters: readonly HostCharacter[]): Promise<BookRef[]> {
  const wanted: { id: string; scope: BookRef["scope"] }[] = [];
  const chatBooks = chat && Array.isArray(chat.metadata.chat_world_book_ids) ? chat.metadata.chat_world_book_ids : [];
  for (const id of chatBooks) if (typeof id === "string") wanted.push({ id, scope: "chat" });
  for (const c of characters) for (const id of c.bookIds) wanted.push({ id, scope: "character" });
  const persona = await host.personas.active(userId).catch(() => null);
  if (persona?.bookId) wanted.push({ id: persona.bookId, scope: "persona" });
  for (const id of await host.books.global(userId).catch(() => [])) wanted.push({ id, scope: "global" });
  const out: BookRef[] = [];
  for (const { id, scope } of wanted) {
    if (out.some((b) => b.id === id)) continue;
    const book = await host.books.get(id, userId).catch(() => null);
    if (book && !isEngineBook(book.metadata)) out.push({ id, name: book.name, scope });
  }
  return out;
}

/** The user's chat, or an error that says it can't be read. */
export async function ownChat(host: StudioHost, userId: string, chatId: string): Promise<HostChat> {
  const chat = await host.chats.get(chatId, userId);
  if (!chat) throw new Error("That chat isn't one of yours, or it's gone.");
  return chat;
}

/** The cards of the characters, in order; one that's gone is skipped. */
export async function cardsOf(host: StudioHost, userId: string, ids: readonly string[]): Promise<HostCharacter[]> {
  const out: HostCharacter[] = [];
  for (const id of ids) {
    const card = await host.characters.get(id, userId).catch(() => null);
    if (card) out.push(card);
  }
  return out;
}

/**
 * The sources of one assistant run, read when first needed and kept for the run: a transcript or a
 * book read once serves every tool call after it.
 */
export class SourceReader {
  private transcriptRead: Promise<HostMessage[]> | null = null;
  private cardsRead: Promise<HostCharacter[]> | null = null;
  private readonly entriesRead = new Map<string, Promise<HostBookEntry[]>>();

  constructor(
    private readonly host: StudioHost,
    private readonly userId: string,
    readonly source: DraftSource,
  ) {}

  /** The chat's messages, oldest first; none when the draft has no chat. */
  transcript(): Promise<HostMessage[]> {
    const chatId = this.source.chatId;
    if (!chatId) return Promise.resolve([]);
    this.transcriptRead ??= ownChat(this.host, this.userId, chatId).then(() => this.host.chats.messages(chatId));
    return this.transcriptRead;
  }

  /** The source's character cards, after the user's persona as a card of its own when the draft has one. */
  cards(): Promise<HostCharacter[]> {
    this.cardsRead ??= Promise.all([this.personaCard(), cardsOf(this.host, this.userId, this.source.characterIds)]).then(([persona, cards]) => (persona ? [persona, ...cards] : cards));
    return this.cardsRead;
  }

  /** The persona the draft started with, as cards_read shows it: its name, marked, and its description. */
  private async personaCard(): Promise<HostCharacter | null> {
    const ref = this.source.persona;
    if (!ref) return null;
    const p = await this.host.personas.get(ref.id, this.userId).catch(() => null);
    return p ? { id: p.id, name: `${p.name} (persona)`, description: p.description, personality: "", scenario: "", firstMessage: "", exampleMessages: "", creatorNotes: "", alternateGreetings: [], tags: [], bookIds: p.bookId ? [p.bookId] : [] } : null;
  }

  /** A source book's entries; a book the draft doesn't read is refused. */
  entries(bookId: string): Promise<HostBookEntry[]> {
    if (!this.source.books.some((b) => b.id === bookId)) return Promise.reject(new Error(`book ${bookId} isn't one of this draft's sources`));
    let read = this.entriesRead.get(bookId);
    if (!read) {
      read = this.host.books.entries(bookId, this.userId);
      this.entriesRead.set(bookId, read);
    }
    return read;
  }

  /** Every source book's entries with the book they're in. */
  async allEntries(): Promise<{ book: BookRef; entry: HostBookEntry }[]> {
    const out: { book: BookRef; entry: HostBookEntry }[] = [];
    for (const book of this.source.books) for (const entry of await this.entries(book.id)) out.push({ book, entry });
    return out;
  }
}
