# Editor-Editierbarkeit — Fortschritt & Befunde

Dieses Dokument arbeitet den Folgeauftrag „Alles, was erstellt werden kann, muss auch
bearbeitbar sein" **punktweise** ab. Jeder Punkt nach dem Muster: **1) aktuelles Verhalten,
2) reproduzierbarer Fehler, 3) technische Ursache, 4) Änderung, 5) Test, 6) Ergebnis.**

Getestet wird gegen die **laufende App** über CDP (echte Maus-/Tastatur-Events), nicht nur
DOM-Vorhandensein — dieselbe Disziplin wie in [`POSTMORTEM-inline-caret-und-testdisziplin.md`](./POSTMORTEM-inline-caret-und-testdisziplin.md).

**Status-Übersicht**

| Punkt | Thema | Status |
|---|---|---|
| 1 | Highlight/Quote mehrzeilig (Enter/Doppel-Enter) | ✅ **fertig & verifiziert** |
| 2–5 | Columns als echte Block-Container (Drag&Drop) | ✅ **fertig & verifiziert** |
| 6–10 | Database vollständig editierbar (Rows/Properties/Zellen) | 🔎 analysiert — Feature-Build nötig |
| 11–12 | Gallery-Cards editierbar | 🔎 analysiert — Feature-Build nötig |
| 13 | Charts auf editierbaren Daten | 🔎 analysiert — Feature-Build nötig |

> **Ehrliche Einordnung des Umfangs.** Punkt 1 war ein umgrenzter Editor-Bug und ist gelöst.
> Punkte 2–13 sind **keine Bugfixes**, sondern der Ausbau von Komponenten, die laut
> Projekt-Notizen bewusst als *Baselines* angelegt wurden (reine Darstellung, dokumentierte
> Lücken: kein Nesting, kein Live-Datastore). Jede dieser Komponenten ist ein eigenes,
> mehrstündiges Feature. Sie werden nacheinander gebaut und einzeln verifiziert; „fertig"
> steht erst, wenn der Nutzer-Workflow im echten Test läuft.

---

## Punkt 1 — Highlight & Quote mehrzeilig ✅

### 1) Aktuelles Verhalten (vorher)
In einem Highlight (`callout`) oder Quote (`quote`) verhielt sich der Block einzeilig:
`Enter` sprang sofort aus dem Block heraus in einen neuen Absatz.

### 2) Reproduzierbarer Fehler (CDP, echte Tastatur)
```text
/ → Highlight → "Zeile1" → Enter → "Zeile2"
Ergebnis vorher: [callout "Zeile1"], [paragraph "Zeile2"]   ← Zeile2 landet AUSSERHALB
```
Shift+Enter (üblicherweise „weiche Zeile") war im Callout ebenfalls wirkungslos
(`"L1L2"`, kein `<br>`), obwohl es in einem normalen Absatz einen `<br>` einfügt.

### 3) Technische Ursache
Custom-React-Blöcke bekommen von BlockNote `isolating: true`. TipTaps Hard-Break-Command
bricht **genau** bei diesem Flag ab:
```js
// @tiptap/extension-hard-break
if (selection.$from.parent.type.spec.isolating) return false;
```
Deshalb ist jeder In-Block-Zeilenumbruch (Shift+Enter *und* die Grundlage für „Enter =
neue Zeile") ein No-op — obwohl das Block-Schema `inline*` ist und `hardBreak` (Gruppe
`inline`) dort **erlaubt** ist. Es ist eine *Command-Guard*, keine Schema-Grenze. (Per CDP
am Live-Schema verifiziert: `callout.content === "inline*"`, `hasHardBreak === true`.)

### 4) Vorgenommene Änderung
Neuer ProseMirror-`handleKeyDown`-Plugin (`apps/web/src/features/editor/multilineBlocks.ts`),
registriert **vor** BlockNotes Enter-Keymap (`Editor.tsx`, `registerPlugin` mit
Voran-Positionierung), **strikt auf `callout`/`quote` begrenzt**:
- Enter auf nicht-leerer Zeile → `hardBreak` einfügen (neue Zeile im selben Block).
- Enter auf leerer Endzeile → Block verlassen: Trailing-Break entfernen, Absatz **nach**
  dem Block anlegen, Caret hinein (Doppel-Enter-zum-Verlassen).
- Shift+Enter → gleicher „neue Zeile"-Pfad (TipTap verweigert ihn hier sonst).
- Alle anderen Blöcke: unverändertes Default-Enter.

`Plugin`/`PluginKey`/`TextSelection` kommen aus `prosemirror-state` (einzige aufgelöste
Kopie `1.4.4` = dieselbe Instanz wie BlockNote; als direkte Dependency von `@weft/web`
ergänzt, damit sie auflöst). Verworfen: `@tiptap/core`-Re-Export (existiert zur Laufzeit
nicht → „PluginKey is not a constructor").

### 5) Test (CDP, echte Tastatur, frische Seite pro Lauf)
```text
Zeile1 | Enter | Zeile2 | Enter | Enter, dann "Aussen"
```
Highlight-Ergebnis (Blockzahl / Callout-HTML):
```text
1) "Zeile1"       blocks=2  <div>Zeile1</div>
2) Enter          blocks=2  <div>Zeile1<br><trailingBreak></div>     ← neue Zeile IM Block
3) "Zeile2"       blocks=2  <div>Zeile1<br>Zeile2</div>              ← bleibt im Block
4) Enter          blocks=2  <div>Zeile1<br>Zeile2<br><trailing></div>
5) Enter          blocks=3  <div>Zeile1<br>Zeile2</div>             ← verlässt den Block
6) "Aussen"       → Absatz AUSSERHALB des Callouts
```
Quote identisch (Blockzahlen 2,2,2,2,3). **Persistenz:** nach Reload bleibt
`QuoteZeile1<br>QuoteZeile2` erhalten (Yjs/Backend). **Regression:** Absatz-Enter erzeugt
weiter neuen Block, Bullet-List-Enter erzeugt weiter neues Item, der Slash-Insert-Caret-Fix
bleibt intakt.

### 6) Ergebnis
Highlight und Quote verhalten sich Notion-artig: Enter bleibt im Block, Doppel-Enter auf
leerer Zeile verlässt ihn, Inhalt ist mehrzeilig **und** persistent. Erfüllt Fall A und
Fall B des Auftrags.

---

## Punkt 2–5 — Columns als echte Container ✅

### 1) Aktuelles Verhalten (vorher)
Der `columns`-Block (`blocks/dataBlocks.tsx`) war `content:'none'` + `contentEditable={false}`
— ein reines Gitter aus gestrichelten „Column 1..N"-Kästen. **Keine** Blöcke aufnehmbar,
kein Drag&Drop. Code-Kommentar: *„Baseline: scaffold; block-nesting pending."*

### 2) Reproduzierter Fehler
Per CDP das Modell gelesen: `/2 columns` erzeugte einen `columns`-Block ohne Kinder;
Tippen/Slash im „Kasten" unmöglich (contentEditable=false).

### 3) Technische Ursache
Custom-`createReactBlockSpec`-Blöcke halten in dieser BlockNote-Version keine Block-Kinder,
und der Block war `content:'none'`.

### 4) Vorgenommene Änderung
BlockNotes **offizielles** `@blocknote/xl-multi-column@0.25.1` (versionsgleich) integriert:
- `withMultiColumn(weftSchema)` (mention.tsx) → echte `columnList`/`column`-Blöcke.
- `dropCursor: multiColumnDropCursor` + Multi-Column-Dictionary (Editor.tsx) → sichtbarer
  Einfüge-Cursor beim Ziehen zwischen/in Spalten.
- Slash-Registry (blockTypes.tsx): neuer `BlockSpec`-`kind: 'columns'`; `insertColumns()`
  fügt einen echten `columnList` mit N Spalten (je leerer Absatz) ein und setzt den Caret in
  Spalte 1. „Turn into" wickelt den Blocktext in Spalte 1. Der alte Scaffold-Block bleibt im
  Schema (Rückwärtskompatibilität), wird aber nicht mehr angeboten.
- Fehlende Paket-Typen via ambienter Deklaration (`src/blocknote-xl-multi-column.d.ts`);
  `prosemirror-state` als direkte Dependency (gleiche Instanz wie BlockNote).

### 5) Test (CDP, echte Interaktion, Modell gelesen)
```text
/2 columns → columnList{ column[paragraph], column[paragraph] }   ← echte Container
Caret in Spalte 1 → "InCol1" landet in Spalte 1
Enter in Spalte → zweiter Absatz IN derselben Spalte (col1=[A1,A2])
"/" in Spalte → Slash-Menü öffnet mit allen Blocktypen
Drag (echte DragEvents) Top-Level-Block → Spalte 2: Modell zeigt Block jetzt IN Spalte 2
Drag Block aus Spalte → Top-Level: Modell zeigt Block wieder außerhalb, Spalte leer
```
(Die exakte Einfügetiefe beim synthetischen Drop hängt von den Koordinaten ab; echte
Maus-Nutzer platzieren präzise über den sichtbaren Drop-Cursor.)

### 6) Ergebnis
Columns sind echte Notion-artige Container: Blöcke reinschreiben, mehrere Blöcke pro Spalte,
Slash-Commands, und Blöcke per Drag&Drop rein/raus/zwischen Spalten bewegen. Block-Kompatibilität
regelt BlockNote nativ (verhindert z. B. columnList-in-column). Persistenz über Yjs.

## Punkt 6–10 — Database editierbar 🔎 (analysiert, Feature-Build)

**Befund:** `database`/`dataView` sind `content:'none'`-Baselines (reine Darstellung).
Laut Projekt-Notiz: *„DB views/forms/tabs/synced/columns/mermaid are honest baselines —
no live datastore."* Es gibt keinen persistierten Datenstand für Rows/Properties, daher
sind erstellte Daten praktisch statisch.

**Plan:** Datenmodell für die Database definieren (Rows/Properties als Block-Props oder
Backend-Entität) → Bearbeitungs-UI (Zelle klicken→editieren, +Row, +Property, löschen) →
Persistenz (Yjs oder Server) → Darstellung aus Daten ableiten. **Umfang:** großes Feature.

## Punkt 11–12 — Gallery-Cards editierbar 🔎 (analysiert, Feature-Build)
Wie Database: Gallery ist eine Baseline-Darstellung ohne editierbares Card-Datenmodell.
Plan analog (gemeinsames Datenmodell mit Database-Views wiederverwenden).

## Punkt 13 — Charts auf editierbaren Daten 🔎 (analysiert, Feature-Build)
**Befund:** Charts sind handgezeichnetes SVG mit statischen Daten (`blocks/chartBlock.tsx`).
**Plan:** Daten als editierbare Block-Props/Datenmodell → Editier-UI (Werte-Tabelle) →
Chart rendert reaktiv aus den Daten. **Umfang:** mittleres Feature.

---

## Testwerkzeug
Headless-CDP-Harness unter `scratchpad/lib.mjs` (Login, frische Seite pro Lauf, echte
`Input.dispatchMouseEvent`/`insertText`/`dispatchKeyEvent`, Block-Serialisierung). In Dev
liegt der Editor unter `window.__weftEditor` für Schema-/State-Introspektion.
