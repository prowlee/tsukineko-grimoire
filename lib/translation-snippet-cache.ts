import crypto from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from '@/lib/firebase-admin';

/** /api/citation のスニペット翻訳キャッシュ用コレクション */
export const SNIPPET_TRANSLATION_COLLECTION = 'translation_snippet_cache';

export const SNIPPET_TARGET_LANG_JA = 'ja';

/** get / save / ハッシュ生成で共通の原文正規化（前後空白のみ） */
export function normalizeSnippetSourceText(text: string): string {
  return text.trim();
}

/**
 * キャッシュキー: SHA-256( targetLanguage + "\\n" + normalizedSource ) を 16 進文字列化。
 * Firestore ドキュメント ID として安全な長さ・文字種。
 */
export function buildSnippetTranslationDocId(
  sourceText: string,
  targetLanguage: string
): string {
  const n = normalizeSnippetSourceText(sourceText);
  return crypto
    .createHash('sha256')
    .update(`${targetLanguage}\n${n}`, 'utf8')
    .digest('hex');
}

export async function getCachedSnippetTranslation(
  db: Firestore,
  sourceText: string,
  targetLanguage: string
): Promise<string | null> {
  const n = normalizeSnippetSourceText(sourceText);
  if (!n) return null;
  const id = buildSnippetTranslationDocId(sourceText, targetLanguage);
  const snap = await db.collection(SNIPPET_TRANSLATION_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const ja = snap.data()?.translatedText;
  return typeof ja === 'string' && ja.length > 0 ? ja : null;
}

export async function saveSnippetTranslation(
  db: Firestore,
  sourceText: string,
  targetLanguage: string,
  translatedText: string
): Promise<void> {
  const n = normalizeSnippetSourceText(sourceText);
  if (!n || !normalizeSnippetSourceText(translatedText)) return;
  const id = buildSnippetTranslationDocId(sourceText, targetLanguage);
  const ref = db.collection(SNIPPET_TRANSLATION_COLLECTION).doc(id);
  const snap = await ref.get();
  await ref.set(
    {
      sourceTextHash: id,
      targetLanguage,
      translatedText: translatedText.trim(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(!snap.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  );
}
