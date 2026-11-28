// accessibility.en.tsx: the English accessibility statement, a translation of accessibility.de.tsx: change the two
// together. The German version is the one the operator reads and releases; where the two differ, it is the German one
// that was meant. The act's German name is marked as German.
import { Link } from "react-router";
import { name as app } from "../../sebaro.product.json";
import { OperatorBlock } from "./parts";

export function AccessibilityEn() {
  return (
    <>
      <p>
        This page describes how {app} can be used without a mouse, with a screen reader, with large text or with less
        motion, what was checked for that and what was not. According to its operator, {app} falls under an exception of
        the German Accessibility Strengthening Act (<span lang="de">Barrierefreiheitsstärkungsgesetz</span>, BFSG). This
        statement is published voluntarily; you can still report barriers (see “Reporting barriers”).
      </p>

      <h2>What {app} is</h2>
      <p>
        {app} is a wall for a team's brainstorming. One person creates a wall with a question and shares the link;
        everyone else joins with a display name, without an account. Everyone writes notes, hidden at first, until the
        facilitator reveals them. Then, if the facilitator asks for it, an AI groups the notes, or everyone groups them
        by hand. The result can be saved as a Markdown file. {app} is free, in German and in English, and the private,
        non-commercial project of one person.
      </p>

      <h2>How to use {app}</h2>
      <p>
        A wall comes in two views with the same actions: as a <strong>surface</strong>, on which notes and groups lie
        freely, and as a <strong>list</strong> with the groups as headings and the notes as rows. You switch with
        “Surface” and “List” at the top of the wall. On a narrow screen a wall opens as its list as long as you have not
        chosen otherwise. The list is the way for screen readers.
      </p>

      <h3>Keyboard</h3>
      <ul>
        <li>
          The first tab stop of every page is the “Skip to content” link. It appears once it has focus and takes you
          past the page header to the content.
        </li>
        <li>
          When something is missing in a form, such as the question of a new wall or the name at a wall's door, the
          sentence is at the field, and focus moves there.
        </li>
        <li>
          The surface is a single tab stop. There the arrow keys go from note to note, G to the next group; Enter edits
          the text or the title, Delete deletes, N writes a new note. M moves the note or the group with the arrow keys,
          with Shift they change a group's size; Enter puts it down, Escape cancels. V opens “Move to …” with the groups
          as a choice: this replaces dragging. Space selects a note, Shift with the arrow keys adds more. Plus and minus
          zoom, 0 shows everything. The surface names these keys in its description, and on wide screens the “Keys”
          button shows them under the surface.
        </li>
        <li>
          In the list every row has its menu “More for …” with “Edit”, “Move to …” and “Delete”, and every group has its
          own.
        </li>
        <li>
          Menus and dialogs close with Escape, and focus returns to the button that opened them. The command palette
          opens with Ctrl+K (⌘K on a Mac).
        </li>
        <li>
          Several methods in a row: “Add another method” puts the focus into the choice of the method, whose arrow keys
          choose it. Every method in the agenda has the buttons “Choose method”, “Move up”, “Move down” and “Remove”;
          after a move the focus stays on the same button. Nothing is dragged.
        </li>
        <li>
          Controls show the focus outline of sebaro, the design system of {app}. This has not been checked for every
          control.
        </li>
      </ul>

      <h3>Screen readers</h3>
      <p>
        The pages have headings, landmarks and the page's language. On a wall a status line announces what changes, such
        as how many notes are selected or that the AI is grouping; when a change is not taken, a notice says so. The
        surface presents itself to a screen reader as a list box of its groups and notes, with the keys in its
        description. The wall's list is more convenient. {app} tells nobody who wrote a note, not a screen reader
        either; one's own note says “Yours”. None of this has been tested with a screen reader.
      </p>

      <h3>Touch</h3>
      <p>
        On the surface one finger moves the view or a note, two fingers move and zoom. You select several notes without
        a Shift key when you switch on “Select” in the surface's tools: then every press on a note takes it into the
        selection or out of it. In the list, “Move to …” moves one note at a time.
      </p>

      <h3>Large text</h3>
      <p>
        {app} follows your browser's text size. Zoomed out, the surface draws its notes smaller than that text; plus
        zooms in, and the list shows every text at the size you set.
      </p>

      <h3>Motion</h3>
      <p>
        When the facilitator applies a proposal of the AI, the notes glide to their new places, for at most 600
        milliseconds. If your system is set to reduce motion, or you turned on “Always reduce motion” in the settings of{" "}
        {app}, they jump instead. Menus and dialogs still fade in within 200 milliseconds.
      </p>

      <h3>Time</h3>
      <p>
        The facilitator can set a clock for the writing. When it runs out nothing locks: everyone writes on until the
        facilitator reveals the notes.
      </p>

      <h3>Light or dark, language</h3>
      <p>
        On your first visit {app} follows your system's setting, light or dark. Outside a wall the “Light or dark”
        button in the page header switches, on a wall the “More” menu; there and in the settings you also find the tone
        “Cool” or “Warm”. You switch the language with “DE / EN” in the page header or in a wall's “More” menu, without
        a reload. {app} stores these choices in your browser (see <Link to="/datenschutz">Privacy</Link>).
      </p>

      <h3>Result and link</h3>
      <p>
        “Save as Markdown” gives you the wall as a plain text file, the groups as headings and the notes as list items.
        The wall's QR code (“Show QR code” in the “More” menu) is shown dark on light, also in dark mode, with the same
        link as text under it and “Copy link”.
      </p>

      <h2>Requirements and checks</h2>
      <p>
        The target is level AA of the Web Content Accessibility Guidelines (WCAG) 2.2. {app} is{" "}
        <strong>partially conformant</strong> with it: the automated checks below find nothing on the pages they check,
        but much is not checked, or not checked by hand, and the known limitations are listed further down. A full check
        against the WCAG has not taken place.
      </p>
      <p>
        When a decision weighs accessibility against another goal, the other goal may come first. Every such deliberate
        deviation is listed with its reason under the known limitations. There are none at present.
      </p>
      <p>
        Each check below has one of four states: passed, open, skipped (with a reason) or failed. The results come from
        the runs on the day of this version (above). The automated checks run on every change of the source code, all in
        the Chromium browser.
      </p>

      <h3>Automated checks</h3>
      <ul>
        <li>
          The tool axe-core 4.13.0 checks the rules for WCAG 2.0, 2.1 and 2.2 (levels A and AA): every view of {app}{" "}
          with its menus and dialogs, among them the wall as its surface and as its list in every stage (hidden,
          revealed, with the clock, while grouping, with one's own AI key), each light at 390 pixels and dark at 1440
          pixels wide. The surface and the list of a wall with groups, the QR code, the imprint, the privacy notice and
          this page it also checks light at 1440 and dark at 390 pixels, the three legal texts in German and in English.
          Result: passed, with no listed exception. A tool like this finds only part of the possible barriers.
        </li>
        <li>
          Sideways scrolling and text cut off by a frame, on the same pages at 390 and 1440 pixels: passed. The surface
          cuts off on purpose what lies outside its view; it is checked as it opens, with every note in view.
        </li>
        <li>
          Text at double size (200 %) at 1440 pixels wide, light, for the start page (also with the guided methods), a
          wall's door, “New wall” with an agenda of three methods, the wall in its stages and its “Agenda” dialog: no
          sideways scrolling, no cut text, no axe findings: passed.
        </li>
        <li>
          Tests with the keyboard only: create a wall (with the sentence at the field first) and join it at its door;
          delete the wall through the dialog, with focus back after Escape; “Light or dark” and the language in the page
          header and in the “More” menu; the command palette; on the surface write, edit, move and delete a note, move,
          resize, rename and delete groups, select several notes; in the list a row's menu and “Move to …”; group,
          discard, apply and take back in the list; put together an agenda of three methods under “New wall” (add,
          choose, a question per method, move) and create the wall: passed. This is no walk-through of all tasks.
        </li>
        <li>
          sebaro's four fixed tasks with the keyboard only: create something (a wall) passed; delete it after a
          confirmation passed; switch between light and dark passed; open a receipt skipped, reason: {app} has no
          receipts.
        </li>
        <li>
          Reduced motion, the system's and the setting of {app}: the notes jump to their places when grouped, without
          gliding: passed.
        </li>
        <li>
          Touch, simulated in the browser: “Select” with single presses, two fingers on the surface: passed. This is no
          real device.
        </li>
      </ul>

      <h3>Open checks</h3>
      <ul>
        <li>Screen readers, for example VoiceOver, NVDA or TalkBack, on the surface and in the list: open.</li>
        <li>The Firefox and Safari browsers: open. Every check runs in Chromium only.</li>
        <li>Real phones and tablets with touch, including the on-screen keyboard: open.</li>
        <li>
          A walk-through of all tasks with the keyboard only: open. Without a test of their own are, for example,
          revealing, the clock, “Delete my details”, “Save as Markdown” and “Show QR code”.
        </li>
        <li>A visible focus outline on every control: open. No check reads it.</li>
        <li>
          axe light at 1440 and dark at 390 pixels for the other views, and in English apart from the start page, the
          door and the legal texts: open.
        </li>
        <li>Text cut off on a surface that was moved or zoomed: open.</li>
        <li>Forced colors and the system's contrast modes: open.</li>
        <li>
          Zooming the browser to 400 %, which means a width of 320 pixels: open. The check above doubles the text size;
          that is not the same.
        </li>
        <li>Larger spacing between lines, paragraphs, words and letters: open.</li>
        <li>The Markdown file in a program that reads it aloud: open.</li>
      </ul>

      <h2>Known limitations</h2>
      <p>Because no manual check has run yet, this list is not complete.</p>
      <ul>
        <li>
          The surface is built for eyes and pointers. For a screen reader it is a long list without the places of the
          notes; the wall's list is the better way. Nobody has listened to either.
        </li>
        <li>
          A group's frame and its handle for the size are dragged with a pointer; with the keyboard, M and Shift with
          the arrow keys do it. With a finger on a real device this has not been tried.
        </li>
        <li>Zoomed out, the text on the surface is smaller than the text size you set (see “Large text”).</li>
        <li>Screen readers, real devices, Firefox and Safari have not been tested.</li>
      </ul>

      <h2>Reporting barriers</h2>
      <p>If you run into a barrier in {app} or cannot use something, write to:</p>
      <OperatorBlock emailLabel="E-mail:" />
      <p>
        It helps to know which page it was, and which browser and assistive technology you use. No response time is
        promised.
      </p>
    </>
  );
}
