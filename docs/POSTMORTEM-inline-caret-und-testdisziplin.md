# Post-mortem — Der Inline-Caret-Bug und die Kosten des Nicht-Testens

**Datum:** 2026-08-14 · **Bereich:** Block-Editor (BlockNote / ProseMirror / TipTap-React) ·
**Dauer bis zur echten Lösung:** mehrere Stunden über mehrere Sessions, **drei** „endgültige"
Fixes, von denen die ersten zwei nie wirklich funktioniert haben ·
**Status:** gelöst und end-to-end verifiziert

> Dieses Dokument ist bewusst länger als ein normales Post-mortem. Es beschreibt nicht nur
> *was* der Bug war, sondern *wie gedacht wurde*, *warum es so lange dauerte*, *warum vorher
> falsch „gelöst" gemeldet wurde*, und *wie man beim nächsten Mal vorgeht*. Die rein
> technische Kurzfassung steht in [`BLOCK-INLINE-INPUT-FIX.md`](./BLOCK-INLINE-INPUT-FIX.md).
> Wenn du nur den Code-Fix brauchst, lies dort §7a. Wenn du verstehen willst, warum uns diese
> Klasse von Bug immer wieder erwischt, lies hier weiter.

---

## 0. TL;DR (für Eilige und für den Kollegen)

- **Symptom:** `/` → *Highlight* / *Quote* / *Toggle* auswählen → sofort tippen. Das erste
  Zeichen landet **nicht** im Block, sondern erzeugt einen **neuen Block** darunter. Nur ein
  zusätzlicher **Mausklick** in den Block stellte den brauchbaren Zustand her.
- **Wahre Ursache:** Beim Einfügen ist die **Modell-Selektion** von BlockNote bereits korrekt
  im neuen Block. Aber für einen **leeren Custom-React-Block** synchronisiert ProseMirror den
  **Browser-Caret nie** in das Inhaltselement — die DOM-Selektion bleibt an der Blockgrenze
  (`DIV.bn-block`, Offset 1) *außerhalb* des Editierbereichs hängen. `setTextCursorPosition`
  kann diesen DOM-Caret **nicht** dorthin bewegen — egal ob in einem Frame oder in zwanzig.
- **Warum es so lange „nicht ging":** Die ersten zwei Fixes haben immer nur den *Modell*-Caret
  neu gesetzt (Theorie: „das React-Node-View mountet asynchron zu spät"). Diese Theorie war
  *plausibel und teilweise wahr*, aber **nicht die eigentliche Fehlerstelle**. Und —
  entscheidend — **keiner der beiden Fixes wurde je durch echtes Tippen getestet**. Es wurde
  „gelöst" gemeldet, weil der Block *richtig aussah*.
- **Der Fix:** Genau das tun, was der Mausklick tut — nach dem Mount einen **kollabierten
  DOM-`Range`** in das leere Inhaltselement setzen, damit ProseMirror die Selektion übernimmt.
- **Die eigentliche Lehre:** Der schwierige Teil war **nicht das Lösen** (der Fix sind ~25
  Zeilen), sondern **das ehrliche Reproduzieren und Beobachten**. Selbst mein *erster*
  headless-Test hat gelogen, weil er 80 ms vor dem Tippen wartete und damit den Fehler
  verdeckte. Erst „sofort tippen wie ein echter Nutzer" hat den Bug gezeigt.

---

## 1. Ausgangslage — welcher Zustand herrschte, als ich übernahm

### 1.1 Das gemeldete Verhalten

Im Notion-artigen Editor konnte man über das `/`-Menü Blocktypen einfügen. Die meisten
funktionierten. Aber bei **Highlight** (intern `callout`), **Quote** und **Toggle**:

1. `/` tippen, Block auswählen → Block erscheint optisch korrekt.
2. Der Cursor *sieht aus*, als stünde er im Block.
3. Erstes Zeichen tippen → **Zeilenumbruch / neuer Block**, Text landet außerhalb.
4. Workaround: mit der Maus in den Block klicken → *dann* funktioniert Tippen.

### 1.2 Die Vorgeschichte, die ich geerbt habe (das ist wichtig)

Als ich anfing, war der Bug angeblich schon **zweimal** gelöst worden:

| # | Ansatz | Commit | Behauptung | Realität |
|---|---|---|---|---|
| 0 | Caret nach **einem** `requestAnimationFrame` neu setzen | `8735f83` | „definitive fix" | funktionierte nicht zuverlässig |
| — | Ausführliche Post-mortem, die Ansatz 0 als endgültig beschrieb | `a280133` | „root cause + fix" | Ursache nur *halb* richtig, nie durch Tippen bestätigt |

Es gab also bereits ein **selbstbewusstes, gut geschriebenes Post-mortem-Dokument**, das
behauptete, die Ursache sei verstanden und behoben. Das hat mich — siehe §3 — in die Irre
geführt: Ich habe der geschriebenen Analyse mehr vertraut als der laufenden App.

### 1.3 Was im Code stand

Ein einziger geteilter Einfügepfad (`insertBlockType` in `blockTypes.tsx`), der für
Custom-Inline-Blöcke eine Hilfsfunktion `focusInsertedInlineBlock` aufrief. Die
Guard-Bedingung (`content === 'inline' && type in weftCustomBlockSpecs`) war **korrekt** —
`callout` und `quote` erfüllten sie beide. Das Problem lag also **nicht** an der Guard.

---

## 2. Wie ich gedacht habe — meine Vermutungen und warum sie plausibel waren

Mein erster Reflex war eine saubere, mechanistische Geschichte, und sie klang überzeugend:

> „Custom-React-Blöcke mounten ihr editierbares `contentDOM` **asynchron** — einen
> React-Commit *nach* dem ProseMirror-Knoten. `insertOrUpdateBlock` setzt den Caret
> **synchron**, also *bevor* das Editable existiert. Ein einzelnes `requestAnimationFrame`
> ist ein **Rennen**: Manche Blöcke mounten in diesem einen Frame (Toggle), andere einen
> Frame später (Highlight/Quote) — deshalb verlieren genau die das erste Zeichen."

Warum diese Theorie so verführerisch war:

- Sie war **teilweise wahr**. Custom-React-Node-Views *mounten* tatsächlich asynchron.
- Sie **erklärte das Muster**: eingebaute Blöcke gehen, Custom-Blöcke nicht.
- Sie **passte zum bestehenden Post-mortem**, das dieselbe Timing-Erzählung hatte.
- Sie führte zu einem **eleganten Fix**: „statt einem Frame → jeden Frame neu versuchen, bis
  die DOM-Selektion im Block ist." Klingt robust, deterministisch, sauber.

Ich habe also die Hilfsfunktion umgeschrieben: `editor.focus()` + `setTextCursorPosition`
**in jedem Animationsframe**, bis `[data-id]` die `window.getSelection().anchorNode` enthält,
mit Sicherheitscap. Typecheck grün. Commit. „Gelöst."

**Das war falsch.** Nicht nur die Umsetzung — die ganze Denkrichtung. Ich habe den *Modell*-
Caret behandelt, obwohl das Problem der *Browser*-Caret war. Aber das konnte ich vom Code aus
nicht *sehen* — nur *vermuten*. Und genau da liegt der Fehler: ich habe eine Vermutung wie
eine Feststellung behandelt.

---

## 3. Warum ich zuvor nicht getestet habe — die ehrliche Analyse

Das ist der Teil, den du explizit sehen wolltest, und der Teil, der uns beim nächsten Mal am
meisten hilft. Ich zerlege es in die einzelnen Denkfehler, ehrlich benannt.

### 3.1 Ich habe eine „no-testing"-Regel falsch ausgelegt

Es gibt eine feste Arbeitsvereinbarung in meinem Gedächtnis: *„Implementation only — keine
Tests, keine Browser-Automation; du testest die App selbst."* Diese Regel ist sinnvoll —
sie bedeutet: **schreibe keine Test-Suites, mache keine UI-QA-Theater**. Sie bedeutet
**nicht**: *„behaupte Erfolg ohne jeden Beleg."*

Ich habe „ich muss keine Tests schreiben" umgedeutet in „ich muss nicht überprüfen, ob es
funktioniert". Das ist ein Kategorienfehler: *Verifikation* (habe ich das Richtige gebaut?)
ist nicht dasselbe wie eine *Test-Suite* (dauerhafte automatisierte Tests). Die Vereinbarung
verbietet Letzteres, nicht Ersteres.

### 3.2 Ich habe eine kohärente Geschichte mit Verständnis verwechselt

Der gefährlichste Denkfehler. Ich hatte eine **in sich schlüssige Kausalgeschichte** (async
Mount → Rennen → verlorenes Zeichen). Weil sie sich *rund anfühlte* und *alle Symptome
erklärte*, fühlte sie sich an wie *Wissen*. Aber „ich kann eine überzeugende Geschichte
erzählen, warum X passiert" ist nicht dasselbe wie „ich habe beobachtet, dass X passiert".

Eine gute Geschichte ist eine **Hypothese**, kein Beweis. Ich habe die Hypothese nicht gegen
die Realität gehalten.

### 3.3 Ich habe geerbtes Vertrauen aufsummiert

Das bestehende Post-mortem war selbstbewusst und detailliert und behauptete, die Ursache sei
gefunden. Ich habe darauf **aufgebaut**, statt es zu **prüfen**. So entsteht eine *Kette
unbestätigter Behauptungen*: Ansatz 0 behauptete Erfolg ohne Tastatur-Test → das Dokument
schrieb das fest → ich baute darauf auf und behauptete erneut Erfolg. Jede Schicht lieh sich
Glaubwürdigkeit von der vorherigen, aber **keine** war je an echtem Tippen gemessen worden.

### 3.4 Ich habe „Typecheck grün" als „fertig" gelesen

`tsc --noEmit` sagt nur: die Typen passen. Es sagt **nichts** über Laufzeitverhalten, DOM,
Selektion, Fokus. Ein grüner Compiler gab mir ein falsches Gefühl von Abgeschlossenheit.

### 3.5 Ich habe meinen eigenen Debugging-Prozess verletzt

Ich hatte sogar das „Systematic Debugging"-Vorgehen aufgerufen, dessen **Phase 1** lautet:
*„Reproduce Consistently"* — **bevor** irgendein Fix. Ich habe Phase 1 übersprungen und bin
direkt zu „Fix bauen" gesprungen, weil das geerbte Dokument die Reproduktion *ersetzt* zu
haben schien. Der Prozess war richtig; ich habe ihn nicht befolgt.

> **Kern:** Ich bin nicht aus Faulheit nicht zum Testen gekommen. Ich bin nicht getestet
> gekommen, weil ich *überzeugt war, es nicht zu brauchen* — und diese Überzeugung kam aus
> einer plausiblen Geschichte plus geerbtem Vertrauen plus einer fehlinterpretierten Regel.
> Das ist gefährlicher als Faulheit, weil es sich wie Sorgfalt anfühlt.

---

## 4. Der Wendepunkt — und wie sogar mein *erster* Test noch gelogen hat

Deine Ansage („test your shit — do exactly what I did") hat den einzigen richtigen nächsten
Schritt erzwungen: **die echte App fahren und wirklich tippen.**

Aber hier kommt die zweite, subtilere Lehre. Mein **erster** headless-Reproduktionsversuch
hat den Bug **nicht** gezeigt — er meldete fälschlich „funktioniert":

```text
right after insert  blocks: [{callout "💡"},{paragraph ""}]
after typing "A"    blocks: [{callout "💡A"},{paragraph ""}]   ← sieht gut aus … war aber gelogen
```

Warum? Weil mein Test **80 ms wartete**, bevor er „A" tippte — und in diesen 80 ms (~5 Frames)
hatte der asynchrone Retry-Fix genug Zeit, den Zustand notdürftig zu kompensieren. **Ein
echter Nutzer wartet keine 80 ms.** Die Verzögerung war ein **Artefakt des Tests**, kein
Merkmal der Realität.

Erst als ich **alles** zwischen dem Menü-Klick und dem Tastendruck entfernte — sofort tippen,
kein `sleep`, kein Zwischen-`eval` — kam der Bug hervor:

```text
after typing "A"   blocks: [{callout "💡"},{callout "💡A"},{paragraph ""}]
                                   ↑ leerer erster Callout   ↑ ZWEITER Callout mit dem Text
```

**Da war der Beweis:** Das erste Zeichen erzeugt einen zweiten Block. Genau dein „unerwarteter
Zeilenumbruch / neuer Bereich".

> **Lehre (die zweite Testfalle):** Ein Test, der die echte Interaktion nicht *treu*
> nachbildet, ist schlimmer als kein Test — er gibt einen **falschen Freibrief**. Jede
> künstliche Verzögerung, jede Zwischenmessung, jeder „stabilisierende" Wartepunkt kann genau
> das Rennen verdecken, das den Bug ausmacht. Reproduziere den *Worst-Case-Timing* des echten
> Nutzers (sofort, ohne Pause), nicht den bequemen.

---

## 5. Wie ich es dann *richtig* getestet habe — die Methodik

Keine Test-Suite, kein Playwright (Arbeitsvereinbarung). Stattdessen: die **laufende App
headless über das Chrome DevTools Protocol (CDP)** fahren — genau das, was ein Nutzer tut, nur
skriptgesteuert und messbar. Node 24 hat globales `WebSocket` + `fetch`, also ohne
Fremd-Bibliotheken.

**Aufbau (reproduzierbar für den nächsten Fall):**

1. Chrome headless starten mit `--remote-debugging-port`, Ziel-URL `.../login`.
2. Über `/json/list` das Page-Target holen, per WebSocket an CDP andocken.
3. In der Seite per `fetch('/api/auth/login', …)` einloggen (Cookie-Auth, gleiche Origin).
4. **Frische Seite pro Lauf** per `POST /api/pages` erzeugen — sonst verfälscht der Autosave
   der vorherigen Läufe die nächste Messung (das ist mir tatsächlich passiert: `nBlocks:4`
   auf einer „leeren" Seite, weil frühere Testtexte persistiert waren).
5. Zum Editor `/p/:id` navigieren, auf `.bn-block-content` warten.
6. Mit **echten** CDP-Events interagieren: `Input.dispatchMouseEvent` (Klick in Block, Klick
   auf Menüpunkt), `Input.insertText` (`/`, Filtertext, dann das Testzeichen).
7. **Nichts** zwischen Menü-Klick und Tastendruck — sofort tippen.
8. Danach den **Modell-** und **DOM-Zustand** auslesen.

**Die drei Messungen, die die Ursache aufgedeckt haben:**

**(a) Block-Serialisierung** — *wo* landet der Text?
```js
[...document.querySelectorAll('.ProseMirror .bn-block-content')]
  .map(c => ({ type: c.getAttribute('data-content-type'), text: c.textContent.trim() }))
// → [{callout "💡"},{callout "💡A"},{paragraph ""}]   ← zweiter Block = Bug bewiesen
```

**(b) Frame-für-Frame-Sampling der Selektion** (kein Tippen, nur beobachten, 0–500 ms):
```text
t=  0 {"node":"DIV","off":1,"anchorType":"(none)","nBlocks":2}
t=500 {"node":"DIV","off":1,"anchorType":"(none)","nBlocks":2}
```
→ **Der DOM-Caret kommt nie im Callout an.** 500 ms lang bleibt er auf einem `DIV`, Offset 1,
*außerhalb* jedes `.bn-block-content`. Das hat meine Timing-Theorie **widerlegt**: es ist kein
Rennen, das sich „später" auflöst — es löst sich *gar nicht* auf.

**(c) DOM-Dump + Selektionspfad** — *wie* sieht der kaputte Zustand aus:
```text
callout-Knoten:  data-is-empty-and-focused="true"     ← Modell denkt: Caret ist hier
Inhalts-<div>:   <div class="min-h-[1lh] …"></div>    ← komplett leer, KEIN Text-Ziel
Selektion:       anchorNode = DIV.bn-block, offset 1   ← Caret an der Blockgrenze, außen
Pfad:            DIV.bn-block › bn-block-outer › bn-block-group › ProseMirror
```

**So habe ich deine Indizien bestätigt:** Du sagtest „der Cursor *sieht* aus, als wäre er
drin, aber die erste Eingabe macht etwas Falsches, und ein Mausklick repariert es." Genau das
zeigen die Messungen: `data-is-empty-and-focused="true"` (sieht fokussiert aus) **aber**
`anchorNode = DIV.bn-block` (DOM-Caret in Wahrheit außen). Und der Mausklick:

```text
Klick in den Block, dann tippen → [{callout "💡ABC"},{paragraph ""}]   ← ein Block, Text drin
```

Der Klick **repariert genau die DOM-Selektion**. Damit war klar, *was* die Lösung leisten
muss: den Browser-Caret so setzen, wie ein Klick es tut.

---

## 6. Was *genau* im Code das Problem war — und warum es sich so verhält

### 6.1 Modell-Selektion vs. DOM-Selektion

ProseMirror (und damit BlockNote) hat **zwei** Selektionen, die synchron gehalten werden
müssen:

- die **Modell-Selektion** (im EditorState, ein logischer Dokumentoffset), und
- die **DOM-Selektion** (`window.getSelection()`, das, wohin der Browser wirklich tippt).

`editor.setTextCursorPosition(blockId, 'end')` setzt die **Modell**-Selektion. Normalerweise
schreibt ProseMirror die DOM-Selektion daraus ab. **Voraussetzung:** es gibt im DOM ein
gültiges **Text-Ziel** für den Caret.

### 6.2 Warum eingebaute Blöcke gehen und Custom-Blöcke nicht

- **Eingebaute Blöcke** (Absatz, Listen, Heading) bauen ihr `contentDOM` **synchron** in
  `renderHTML`, mit der Klasse `bn-inline-content`, und ProseMirror fügt in ein *leeres*
  Textblock-Element automatisch einen `<br class="ProseMirror-trailingBreak">` ein — das ist
  das **Caret-Ziel**. Der DOM-Caret kann sofort hinein.
- **Custom-React-Blöcke** (`createReactBlockSpec`, z. B. `callout`/`quote`/`toggle`) rendern
  ihr Inhaltselement über TipTaps React-Node-View. Im **leeren** Zustand ist dieses
  `<div ref={contentRef}>` **völlig leer** — kein `bn-inline-content`, **kein** trailing
  `<br>`, kein Text-Ziel. ProseMirror findet also nichts, wohin es den DOM-Caret setzen
  könnte, und lässt die DOM-Selektion an der **Blockgrenze** (`DIV.bn-block`, Offset 1)
  stehen — *außerhalb* des Editable.

### 6.3 Warum das erste Zeichen einen neuen Block erzeugt

Weil der DOM-Caret an der **Grenze zwischen** dem Callout-Knoten und dem nachfolgenden Absatz
steht (Node-Boundary, keine Textposition), interpretiert ProseMirror den Tastendruck dort
nicht als „Text in den Callout", sondern als Eingabe an einer Knotengrenze → es entsteht ein
**neuer Block**. Daher der zweite, leere Callout und der Text darunter.

### 6.4 Warum *jedes* erneute Setzen des Modell-Carets nutzlos war

Beide Vorgänger-Fixes riefen `setTextCursorPosition` (einmal bzw. jeden Frame). Aber das
Problem war nie die Modell-Selektion — die war die ganze Zeit korrekt
(`data-is-empty-and-focused="true"`). Man kann die Modell-Selektion beliebig oft „richtig"
setzen; solange es **kein DOM-Text-Ziel** gibt, wandert der Browser-Caret nicht hinein. Die
Fixes haben eine Variable repariert, die nie kaputt war.

### 6.5 Warum der Mausklick funktioniert

Ein Klick ist ein **nativer** Browser-Vorgang: der Browser macht Hit-Testing auf das
`contenteditable`-Element und setzt den DOM-Caret *direkt* in das (leere) Inhaltselement — er
braucht kein trailing `<br>`, weil er hittestet, nicht ProseMirrors Modell befragt.
Anschließend liest ProseMirrors Selektions-Observer die neue DOM-Selektion und übernimmt sie
ins Modell. Deshalb repariert der Klick den Zustand — und deshalb war er der einzige
Workaround.

---

## 7. Was ich getan habe, damit es sich löst

**Prinzip:** Programmatisch tun, was der Klick tut — den **Browser-Caret** ins leere
Inhaltselement setzen.

Nach dem Mount (auf Animationsframes, bis bestätigt, mit Cap):

```ts
// 1) das leere Inhalts-"Loch" im Block finden (kein contenteditable=false, noch leer)
const hole = /* Element ohne Kind-Elemente bzw. nur mit trailing <br>, im .bn-block-content */;

// 2) Modell-Caret setzen (damit BlockNote/Undo-State mit dem DOM übereinstimmt)
editor.focus();
editor.setTextCursorPosition(blockId, 'end');

// 3) BROWSER-Caret setzen — der Teil, der bisher fehlte (wie ein Klick)
const range = document.createRange();
range.selectNodeContents(hole);
range.collapse(true);
const sel = window.getSelection();
sel.removeAllRanges();
sel.addRange(range);
```

Die Schleife läuft, bis `window.getSelection().anchorNode` wirklich im `[data-id]`-Element
des Blocks liegt (dann sofort Stopp), mit `MAX_FRAMES`-Sicherheitscap. Der ganze Pfad bleibt
durch die bestehende Guard **auf Weft-Custom-Inline-Blöcke beschränkt** — eingebaute und
`content:'none'`-Blöcke (Divider, ToC) gehen den Code nie an.

Code: `apps/web/src/features/editor/blockTypes.tsx`, Funktion `focusInsertedInlineBlock`.

### 7.1 End-to-end verifiziert (mit *sofortigem* Tippen, mehrfach wiederholt)

| Block | Ergebnis |
|---|---|
| Highlight | `[callout "💡ABC"]` — inline, ein Block ✅ |
| Quote | `[quote "ABC"]` — inline, ein Block ✅ |
| Toggle | `[toggle "ABC"]` — inline, ein Block ✅ |
| Bullet List (eingebaut) | tippt inline ✅ (durch Guard unberührt) |
| Divider (`content:none`) | Caret springt zum nächsten Block ✅ (durch Guard unberührt) |

8 aufeinanderfolgende Highlight/Quote-Läufe, alle sauber. Der `anchorNode` ist danach ein
echter `#text`-Knoten *im* Block — nicht mehr die Blockgrenze.

### 7.2 Nebenbefund, der die alte Erzählung korrigiert

Das alte Post-mortem sagte „Toggle geht, Highlight/Quote nicht". Meine Messung zeigt:
**Toggle strandet strukturell genauso** (gleicher `DIV.bn-block`-Offset-1-Zustand). Der
Defekt betrifft **alle** Custom-Inline-Blöcke, nicht nur zwei. Dass Toggle „zu gehen schien",
war vermutlich Timing-Glück bzw. das größere Klickziel — nicht ein struktureller Unterschied.
Merke: Wenn drei Dinge „identisch kaputt" wirken, ist die gemeinsame Ursache wahrscheinlicher
als drei Einzelursachen.

---

## 8. War der Schwerpunkt das Testen oder das Lösen?

**Eindeutig das Testen — genauer: das *ehrliche Reproduzieren und Beobachten*.**

- Das **Lösen** war klein: sobald ich *sah*, dass die DOM-Selektion außen strandet und ein
  Klick sie repariert, war der Fix (DOM-`Range`) offensichtlich und ~25 Zeilen.
- Das **Schwierige** waren drei Hürden, alle auf der Beobachtungsseite:
  1. Überhaupt **anfangen zu testen** (statt einer plausiblen Geschichte zu vertrauen).
  2. Den Test **treu** machen (die 80-ms-Falle → sofort tippen).
  3. Die **richtige Ebene beobachten** (nicht „sieht der Block richtig aus", sondern „wo ist
     die *DOM*-Selektion, Knoten für Knoten").

Das ist ein wiederkehrendes Muster, und der eigentliche Grund für dieses Dokument: **Bei
Editor-/Fokus-/Selektions-Bugs ist die Diagnose 90 % der Arbeit und die Korrektur 10 %.** Wer
hier „schnell rumprobiert und dann behauptet, es gehe", verbrennt Stunden — genau das ist uns
passiert (drei Anläufe).

---

## 9. Roadmap / Playbook — so gehst du (oder ich) das nächste Mal vor

Ein wiederverwendbarer Ablauf. Er ist bewusst als **Reihenfolge** formuliert, weil die
Reihenfolge der Punkt ist: **erst reproduzieren, dann verstehen, dann fixen, dann verifizieren.**

### Schritt 0 — Einen Fix-Anspruch ohne Beleg als *unfertig* behandeln
Wenn irgendwo steht „gelöst / behoben / definitive fix", aber **keine** Aufzeichnung eines
echten Reproduktions- *und* Verifikationslaufs dabei ist: als **unbestätigt** behandeln.
Nicht darauf aufbauen — es erst selbst reproduzieren. (Gilt auch für meine eigenen früheren
Aussagen.)

### Schritt 1 — Reproduzieren, bevor du *irgendetwas* änderst
- Baue die **exakte** Nutzerinteraktion nach, inkl. **Worst-Case-Timing** (sofort tippen,
  keine Kunstpausen).
- Bei diesem Projekt: **CDP über `node --input-type=module -e` + `dangerouslyDisableSandbox`**
  fährt echtes Chrome (siehe `weft-stack`-Notiz). Cookie-Login per `fetch`, **frische Seite
  pro Lauf** (Autosave verfälscht sonst), echte `Input.*`-Events.
- Wenn der Bug im Test *nicht* auftritt: **misstraue dem Test**, nicht der Bug-Meldung. Suche
  die künstliche Bedingung, die ihn verdeckt (Verzögerung, Zwischenmessung, Fokuswechsel).

### Schritt 2 — Auf der richtigen Ebene beobachten
Für Editor-/Caret-/Fokus-Bugs *immer* diese vier Dinge getrennt messen (sie können
auseinanderlaufen — genau das war hier der Bug):
- **Modell-Selektion** (`editor.getTextCursorPosition()`, `data-is-empty-and-focused`),
- **DOM-Selektion** (`window.getSelection().anchorNode` + Offset + Elternpfad),
- **`document.activeElement`** (welches Element hat wirklich Fokus),
- **die reale DOM-Struktur** des Blocks (ist das Inhaltselement leer? gibt es ein Caret-Ziel?).
Sampling **über mehrere Frames** (0–500 ms), nicht nur einmal — so siehst du, ob sich ein
Zustand „auflöst" oder dauerhaft kaputt ist.

### Schritt 3 — Den funktionierenden Fall danebenlegen
Finde einen **ähnlichen Fall, der geht** (hier: eingebauter Absatz/Liste; und der
Mausklick-Workaround) und **vergleiche Feld für Feld**. Der Unterschied *ist* die Ursache.
Hier: eingebauter Block hat trailing `<br>` als Caret-Ziel + `bn-inline-content`; Custom-Block
hat ein leeres `<div>`. Der Klick setzt den DOM-Caret nativ.

### Schritt 4 — Hypothese *minimal* testen, bevor du sie im Code verankerst
Ich habe den DOM-`Range`-Fix **zuerst live in der Seite** (per `eval`) ausprobiert und
bestätigt, dass er den Caret hineinsetzt und Tippen inline landet — **erst danach** habe ich
ihn in den React-Code geschrieben. So verankerst du keine Vermutung.

### Schritt 5 — Am Original-Worst-Case verifizieren, mehrfach
Nach dem Code-Fix: **sofort tippen**, mehrere Läufe (Timing-Rennen sind flaky). Und
**Regressions-Nachbarn** prüfen (hier: eingebauter Block tippt noch inline? Divider springt
noch weiter?).

### Schritt 6 — Ehrlich berichten
„Fertig" nur mit Beleg (konkrete Ausgabe). Wenn etwas nicht getestet wurde: das sagen. Ein
gut aussehender Block ist **kein** Beleg.

### Rote Flaggen, bei denen du sofort stoppen und reproduzieren solltest
- „Ich kann genau erklären, warum das passiert" — aber du hast es nicht *gesehen*.
- „Der frühere Fix/das Dokument sagt, die Ursache sei X" — aber ohne Verifikationsbeleg.
- „Typecheck/Build ist grün, also fertig."
- „Es sieht im UI richtig aus."
- Drei Dinge sind „identisch kaputt", und du baust drei Einzel-Fixes.
- Dein Test braucht ein `sleep`/`wait`, damit er „grün" wird.

---

## 10. Für den Kollegen — die Kurzantworten auf die naheliegenden Fragen

- **Warum ging das so lange nicht?** Nicht weil der Fix schwer war, sondern weil zweimal die
  *falsche Ebene* repariert wurde (Modell-Caret statt DOM-Caret), auf Basis einer plausiblen,
  aber unbewiesenen Timing-Theorie — und weil „gelöst" gemeldet wurde, ohne je ein Zeichen zu
  tippen.
- **Warum geht es jetzt plötzlich?** Weil erstmals der *echte* Zustand beobachtet wurde (DOM-
  Selektion strandet außerhalb des leeren Custom-Node-Views) und der Fix genau das behebt, was
  ein Mausklick auch tut: einen nativen DOM-Caret ins Inhaltselement setzen.
- **Warum war es schwierig?** Weil Modell- und DOM-Selektion *auseinanderlaufen* können und
  alles *korrekt aussieht* (`data-is-empty-and-focused="true"`), während der Browser-Caret in
  Wahrheit woanders steht. Diese Diskrepanz sieht man nur, wenn man beide Ebenen getrennt misst
  — nicht durch Code-Lesen, nicht durch Hinschauen.
- **Was ist die dauerhafte Lehre?** Bei Editor-Bugs: **reproduzieren mit Worst-Case-Timing,
  DOM-Selektion getrennt vom Modell messen, den funktionierenden Fall vergleichen** — und nie
  „fertig" ohne Beleg.

---

## 11. Verwandte Dokumente & Artefakte

- [`BLOCK-INLINE-INPUT-FIX.md`](./BLOCK-INLINE-INPUT-FIX.md) — die technische Post-mortem;
  §7a enthält die korrigierte Ursache + den DOM-`Range`-Fix.
- Code: `apps/web/src/features/editor/blockTypes.tsx` → `focusInsertedInlineBlock`.
- Betroffene Blöcke: `apps/web/src/features/editor/blocks/contentBlocks.tsx`
  (`Quote`, `Callout`, `Toggle`, `SyncedBlock`, `SmartNotes` — alle Custom-Inline).
- Reproduktions-Methodik (CDP headless): siehe `weft-stack`-Notiz „Verifying editor DOM
  headlessly".
