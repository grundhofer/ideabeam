// privacy.en.tsx: the English privacy notice, a translation of privacy.de.tsx: change the two together. Like it,
// adapted from FokusBeam's notice, there from RetroBeam's (docs/HERKUNFT.md), checked against the implementation
// (stages 2 and 3 included: the surface, the list, groups, hidden writing, revealing, the clock, the brake, no writer
// on any frame; state 68a1204; stage 4a, arranging by Workers AI on the server: state c63573e, recipe 588552c, counter
// a0796b5; stage 4b, the facilitator's own key, section 3.5: state 60284aa; stage 5, step A, “Save as Markdown” and the
// QR code, sections 2.1, 3.1, 3.6, 4 and 7: state d3cc22a, read again against the code on 2026-11-25; stage M2 of the
// methods, the hidden vote, sections 3.1 and 3.3; stage M3, estimates, sections 3.1 and 3.3), and a draft
// until the operator has read it. Who is responsible for a run with a key of one's own (section 3.5, “Who is responsible”, and section 6) is the
// operator's understanding and an open point for a legal review. The German version is the one the operator reads
// and releases; where the two differ, it is the German one that was meant.
import { Link } from "react-router";
import { name as app } from "../../sebaro.product.json";
import { CLOUDFLARE_SETTINGS_CHECKED, isPlaceholder, REPO_URL } from "./operator";
import { OperatorBlock, OperatorEmail, Out, PlaceholderField } from "./parts";

export function PrivacyEn() {
  return (
    <>
      <p>
        {app} is a free, non-commercial hobby project of a private person. There are no accounts, no advertising and no
        analytics tools; the application sets no cookies. This notice still describes in full which data is processed
        when you open this application and when you use a wall, where that happens, for how long, and which rights you
        have.
      </p>

      <h2>1. Controller</h2>
      <p>The controller within the meaning of the General Data Protection Regulation (GDPR) is:</p>
      <OperatorBlock emailLabel="E-mail:" />
      <p>There is no data protection officer; this private, non-commercial offer is not obliged to appoint one.</p>

      <h2>2. Hosting and technical operation</h2>
      <h3>2.1 Cloudflare</h3>
      <p>
        The application runs on the platform of <strong>Cloudflare, Inc.</strong>, 101 Townsend St, San Francisco, CA
        94107, USA, in the products “Cloudflare Workers” (application code and the files of the interface) and “Durable
        Objects” (storage of the walls). The data of a wall is stored in a Durable Object with the jurisdiction “EU”
        (Cloudflare jurisdiction <em>eu</em>), which means: the permanent storage and the logic of a wall are bound to
        data centres in the European Union. The Worker in front of it runs at the nearest Cloudflare location, also
        outside the EU, and processes content there in passing: when it takes the question of a wall that is being
        created, when it asks for the question of a wall for the view “Join”, when it forwards the connection to a wall,
        when it passes the file for “Save as Markdown” from the wall on to your browser (section 3.1), and when, for
        grouping, it hands the notes to the AI service and the proposal back to the facilitator (section 3.4). Nothing
        is stored there.
      </p>
      <p>Two limits of this, named openly:</p>
      <ul>
        <li>
          The encrypted connection (TLS) ends at the nearest Cloudflare data centre. Full network residency in the EU is
          an enterprise product of Cloudflare that this hobby project does not use. So your requests may be received at
          a location outside the EU and, as described above, processed in passing before they reach the Durable Object
          in the EU.
        </li>
        <li>
          Cloudflare is a US company and is subject to the US CLOUD Act wherever the data is stored. To balance this,
          the EU-US Data Privacy Framework applies (Cloudflare is certified), as do the standard contractual clauses of
          the EU Commission; in addition, the data is kept to what is needed and is short-lived.
        </li>
      </ul>
      <p>
        As the operator of its network, Cloudflare processes technical data of its own about every request (among others
        the IP address, the address requested, the time, the browser’s identification) to run the network, protect it
        from attacks and find faults. This processing takes place in Cloudflare’s own systems; details are in{" "}
        <Out href="https://www.cloudflare.com/privacypolicy/">Cloudflare’s privacy policy</Out>. A data processing
        agreement with Cloudflare exists through Cloudflare’s standard data processing addendum.
      </p>
      <p>
        Legal basis for the hosting: Art. 6(1)(f) GDPR (legitimate interest in a secure, free and stable operation of
        the offer).
      </p>

      <h3>2.2 What the application itself logs, and what it does not</h3>
      <ul>
        <li>
          The application writes <strong>no access logs</strong>. Cloudflare’s “Invocation Logs”, which would keep the
          full address of every request for some days, are switched off for this application on purpose: the address of
          a wall is at the same time the key to it (section 3.6).
        </li>
        <li>
          The application itself writes no log lines. When a call ends with an unexpected error, Cloudflare records the
          technical error message in its Worker logs; Cloudflare’s retention periods apply there. The application is
          built so that such messages contain no names, questions or texts of notes; for error messages of the platform
          itself this cannot be promised completely.
        </li>
        <li>
          The application <strong>stores no IP addresses</strong>. One exception has to be named honestly: to keep a
          script from creating thousands of walls in a short time and using up the free allowance for everybody, the IP
          address of the requester is used as a counting key <strong>when a wall is created</strong>. This counter lives
          only in the working memory of a single Durable Object, is never written to disk, is not bound to the EU (it
          holds no data of walls) and is dropped a few minutes after the last request at the latest: 60 seconds after
          the last request it is “full” again and is deleted at the next clean-up; when no further request comes,
          Cloudflare removes the idle Durable Object with its counters from memory. The upper bound of a few minutes
          rests on the documented behaviour of the platform, not on a contractual promise. In front of it runs
          Cloudflare’s own rate limiting with the same IP key; Cloudflare manages its volatile counters.
        </li>
        <li>
          The same Durable Object permanently stores one single row: a day (in Coordinated Universal Time, UTC) and the
          number of walls that were created on that day; the first wall of a new day overwrites it. With it the
          application limits the walls per day, so that the free allowance lasts: once the limit is reached, it creates
          no new wall until 00:00 UTC; existing walls go on. The row says nothing about people, walls or IP addresses.
        </li>
        <li>
          Since grouping with AI exists, the same Durable Object stores a second row: the computing that grouping used
          in the last 24 hours, and when each wall was grouped in that time, under a key computed from its address
          instead of the address (section 3.4).
        </li>
      </ul>
      <p>
        Legal basis for the abuse brake and the daily budget: Art. 6(1)(f) GDPR (legitimate interest in protecting the
        free offer from overload).
      </p>

      <h2>3. What is processed when you use a wall</h2>
      <h3>3.1 The data</h3>
      <ul>
        <li>
          <strong>The wall:</strong> its question (at most 140 characters), the time it was created, the day of its
          automatic deletion, a random facilitator key, the chosen method with its steps (a copy from the app’s
          catalogue, stored when the wall is created; for a method that estimates, with the unit the facilitator gave
          for it), which step the wall is in and how far it has got (from which follows whether notes are written hidden
          or have been revealed), the clock of the step (when it runs out or, while paused, how much time is left, and
          how often it was set) and, for the wall’s brake (below), a day in UTC with the number of the first change on
          that day. These details say nothing about persons.
        </li>
        <li>
          <strong>Per person:</strong> the display name (a first name or a pseudonym is enough, at most 40 characters),
          whether the person facilitates, the time of the first join, a random identifier that the wall gives the
          person, and a random session key that your browser creates and with which it shows that you are the same
          person when you come back.
        </li>
        <li>
          <strong>Notes:</strong> up to 500 per wall, each with its text (at most 300 characters), the identifier of the
          person who wrote it, its place on the surface (where the note was created and where it lies now), the group it
          belongs to, and the times it was created and its text was last changed; on a wall that reveals hidden notes in
          turn or asks for hidden notes again after revealing, also the step it was written in. Who moved a note is not
          stored.
        </li>
        <li>
          <strong>Actions:</strong> in a method that agrees on actions (such as “Review against goal and data” or
          “Imagine the failure”), the actions are notes like any other (above). When the facilitator agrees on an
          action, the wall stores two fields with the note: <strong>“Who” and “By when”</strong>, each free text (at
          most 60 and 40 characters), as the team types it, for instance a name or a date. What goes there is the team’s
          to decide; the application does not check it. Both stay stored for as long as the wall exists (section 3.3),
          everyone on the wall sees them, and the file of “Save as Markdown” holds them with the agreed actions. Who
          agreed on an action is not stored.
        </li>
        <li>
          <strong>Decisions and measurable results:</strong> in a method that records decisions (such as “Decision
          record with consent round”) or agrees on measurable results (“Goals with measurable results”), they are notes
          like any other (above). When the facilitator records a decision, the wall stores with the note{" "}
          <strong>its reasons, the objections still open and the review date</strong>; when it agrees on a result,{" "}
          <strong>the goal it belongs to, its target, who owns it and the review date</strong>, each free text as the
          team types it (at most 300, 60 and 40 characters). Who decided is not stored: in this version it is always the
          facilitator, and the application says so. Everything stays stored for as long as the wall exists (section
          3.3), everyone on the wall sees it, and the file of “Save as Markdown” holds it.
        </li>
        <li>
          <strong>Groups:</strong> up to 80 per wall, each with its title (at most 60 characters, it may be missing),
          the place and size of its frame, its position in the order of the groups, and two details for grouping
          (section 3.4): whether the title comes from a person or from the AI and whether grouping leaves the group
          untouched. Who created or changed a group is not stored. A wall of the method “Test your assumptions” begins
          with five such groups (the fields); their titles are in the language of the browser that creates the wall, and
          the language itself is not stored.
        </li>
        <li>
          <strong>Votes:</strong> in a step in which people vote, one ballot per person: which options (groups or notes)
          it gives how many points, the identifier of the person and the running number of the change. Casting again
          overwrites one’s own ballot. When the votes are counted, the wall stores the result: for each option its title
          or text, its points, its place and how many ballots gave it anything, and the number of ballots, without
          identifiers. What is up for the vote the wall fixes when the step begins.
        </li>
        <li>
          <strong>Ratings:</strong> in a step in which people rate (such as “Rating by criteria”), one ballot per person
          with a number from 1 to 5 per option and criterion, as above. Where the criteria are notes, the wall fixes
          their texts when the step begins. When the ratings are counted, it stores only the means per option and
          criterion, the overall value and how many rated, without identifiers.
        </li>
        <li>
          <strong>Consent round:</strong> in “Decision record with consent round”, one answer per person (“Agree”, “Can
          live with it” or “Objection”), an objection with its <strong>reason</strong> (at most 300 characters), like a
          ballot: with the identifier of the person and the running number of the change. When the round is counted, the
          wall stores how many gave which answer and the reasons of the objections, sorted alphabetically and without
          identifiers; everyone on the wall then sees these reasons, and the file of “Save as Markdown” holds them.
        </li>
        <li>
          <strong>Estimates:</strong> in a step in which people estimate, one number per person, like a ballot: the
          number, the identifier of the person and the running number of the change. Casting again overwrites one’s own
          number. When the round is counted, the wall stores only its summary: how many estimated, the median, the
          bounds of the middle half, the smallest and the largest number, without identifiers. The short reason beside
          an estimate is a note like any other (above): hidden until the next step shows it to everyone, without names.
        </li>
        <li>
          <strong>Teams:</strong> in a method with pairs or small groups (such as “1-2-4-All”) the teams: which
          identifiers of people are in which team, the step they were formed for, a random number the application formed
          them with, and the teams before with the moment they were replaced (after a merge or a swap by the
          facilitator). The application forms the teams at random from everyone connected when the step begins; whoever
          comes later joins the smallest team.{" "}
          <strong>The team assignment stays stored for as long as the wall exists</strong> (section 3.3), also after the
          step with the teams. In “Test the counter-position” every team has a role; which one follows from its number
          and is not stored on its own. In a step with teams every person sees their team’s notes, without names; the
          facilitator sees who is in which team, everybody else only their own team with the names in it. In a pair it
          is easy to guess who wrote which note. The file of “Save as Markdown” names only how many teams there were,
          never who was in them. In a method with several rounds (such as “What? So what? Now what?”) the small groups
          stay the same from round to round.
        </li>
      </ul>
      <p>
        For every note, every group and the layout of the notes the wall also keeps the running number of the last
        change, after a grouping also the state before it (section 3.4). Who is connected right now is not stored: the
        application reads “here” and “away” from the open connections.
      </p>
      <p>
        <strong>Writing hidden, then revealing.</strong> Whoever creates a wall chooses whether notes are written
        hidden; that is the default. While notes are written hidden, the server sends a person’s notes only to that
        person’s browser. Everybody else, the facilitator included, gets only a number of the other people’s notes: how
        many there are. Revealing is the facilitator’s, asks first and cannot be taken back; after it everyone sees all
        notes. Only the facilitator sets the clock of the writing phase; everyone sees the time left. When it runs out,
        nothing happens by itself, except in short, timed steps such as those of “1-2-4-All”: there the wall moves on to
        the next step by itself when the clock runs out, which the facilitator can switch off per step. In a method that
        reveals in turn (such as “Silent round with ranking”), the server fixes an order of the hidden notes when the
        step begins, alternating by person and without names; it never leaves the server. With “Next note” the
        facilitator reveals one note after another to everyone. A method that asks for hidden notes again after
        revealing keeps the new notes hidden until a later step shows them; what was revealed already stays visible to
        everyone.
      </p>
      <p>
        <strong>Voting in secret.</strong> People vote in their own browser; only “Cast vote” sends the ballot to the
        server. The server sends a ballot only to the browser of the person who cast it. Everybody else, the facilitator
        included, gets only a number until the votes are counted: how many have voted. Nobody sees a single ballot, not
        after counting either: counting is the facilitator’s, and then everyone gets only the result, all at once. The
        file of “Save as Markdown” holds only the result too. The same holds for estimates: the result is the summary of
        the round. The smallest and the largest number are in it; who estimated them is not. In a small group they still
        let one guess more than a median does. For ratings the result holds only means. In the consent round nobody but
        the person who objects sees the reason of an objection before counting; afterwards everyone sees it, without
        names. In a small group a reason may let one guess who gave it.
      </p>
      <p>
        <strong>Who can do what.</strong> Every person who has joined the wall can write notes. While notes are written
        hidden, every person changes, moves and deletes only their own notes, the facilitator included, and there are no
        groups yet. After revealing, every person can move any note and create, name, move, resize and delete groups, on
        the surface as in the list; only the person who wrote a note still changes its text, and that person or the
        facilitator can delete it.
      </p>
      <p>
        <strong>Everyone on the wall sees</strong> the question, the names, who facilitates and who is here right now,
        after revealing all notes with their text and all groups with their title, before it their own notes and the
        number of the others’. <strong>Who wrote a note the application shows to nobody and sends to no browser</strong>
        , in no phase: the server stores the identifier of the writer with the note, but does not send it. Every browser
        only learns whether a note is its own; there the person who wrote it sees the word “Yours”. That does not make a
        note anonymous in every case: every note carries the times it was written and changed, and everyone sees who is
        here right now and when the number of notes rises. In a small group this can let people guess who wrote
        something.
      </p>
      <p>
        <strong>Save as Markdown.</strong> Every person on the wall can fetch it onto their device as a file with “Save
        as Markdown”. The server puts the file together only at this request, from exactly what the person may see on
        the wall: the question, the groups with their titles, the texts of the notes and the result of a counted vote or
        estimate, never a ballot and never a single estimate; while notes are written hidden, only their own notes and
        the number of the others’. No names are in it, nor who wrote a note. Your browser identifies itself with its
        session key for this (section 4). The server stores nothing about this request and does not keep the file;
        afterwards the file lies on your device alone, and what happens to it is your decision.
      </p>
      <p>
        <strong>The wall’s brake.</strong> A wall stores at most 1,500 changes on one day in UTC (writing, changing,
        moving and deleting notes, groups, ballots). After that it takes no further change until 00:00 UTC; joining, the
        steps with revealing, counting the votes, the clock and deleting the wall go on. It counts the numbers of the
        changes for this, not persons. Purpose and legal basis are the same as for the daily budget (section 2.2).
      </p>
      <p>
        The question, the display name, the texts of the notes and the titles of the groups are free text: write nothing
        into them that not everyone on the wall should read, and nothing about health or other matters that deserve
        special protection. The operator evaluates none of it; the application contains no evaluation per person and,
        apart from the two counters (walls of a day, section 2.2; grouping in the last 24 hours, section 3.4), no
        statistics across walls. What goes to an AI service when grouping is in section 3.4, with a key of the
        facilitator’s own in section 3.5.
      </p>

      <h3>3.2 Where</h3>
      <p>
        In the Durable Object of the wall, in data centres in the European Union (section 2.1). Every wall has its own;
        there is no directory of walls.
      </p>

      <h3>3.3 How long</h3>
      <ul>
        <li>
          A wall deletes itself <strong>30 days after the last time a person joined, automatically</strong>. Coming back
          and every automatic reconnection count as joining too. The deadline moves at most once a day; so the deletion
          lies 29 to 30 days after the last join. If nobody joins, the wall deletes itself 30 days after it was created.
          The application then deletes the whole storage of the wall, with all notes, groups, ballots, teams, actions
          and results. Until then the ballots stay stored per person (the answers and reasons of the consent round too),
          and so do the team assignment, the “Who” and “By when” of the actions and the fields of decisions and
          measurable results. After that the link leads to “Unknown wall”, as for a wall that never existed.
        </li>
        <li>
          The facilitator can delete the wall <strong>at any time</strong> (“Delete wall”): at once and completely, with
          all notes and groups.
        </li>
        <li>
          <strong>Only their own details</strong> every person deletes with “Delete my details” in the wall’s “More”
          menu, after a question: the server then at once removes their display name, their role, their identifier and
          their session key, and their browser removes the wall from its list, with the facilitator key if it held one.
          The person’s notes stay on the wall, without a name: they still carry the identifier they had, which then is
          matched to no display name any more, and they are nobody’s. Nobody can change them afterwards. Their ballots
          likewise stay stored under that identifier and count when the votes are counted. While notes are written
          hidden, they stay hidden, and nobody can delete them, the facilitator neither; after revealing the facilitator
          can delete them. Whoever does not want to leave their notes on the wall deletes them first.
        </li>
        <li>
          The server deletes a <strong>single note</strong> at the command of the person who wrote it, or, after
          revealing, of the facilitator: it then removes the note and its place. When a group is deleted, its notes stay
          where they lie, without a group. A note is deleted on the surface or in the list with “Delete”, a group there
          with “Delete group”; every person on the wall can delete a group.
        </li>
        <li>
          For every way of deleting: for SQLite-backed Durable Objects Cloudflare keeps a recovery history on the side
          of the platform, up to 30 days according to Cloudflare’s documentation, from which only the operator could
          restore through a programming interface. The application does not use this function; no way of switching it
          off is documented. Only after this period is deleted data gone on the side of the platform too.
        </li>
      </ul>

      <h3 id="ordnen">3.4 Grouping with AI</h3>
      <p>
        <strong>Who starts it.</strong> Only the facilitator, with “Group notes”, and only after revealing. At most six
        times per wall in 24 hours; on top of that the whole application has an amount of computing for 24 hours, and
        once it is used up, no wall is grouped with AI until enough of it is older than 24 hours. Cloudflare itself can
        also refuse, when the account’s free allowance is used up; the application then says so, but cannot name a time,
        and the run sends no further request. Grouping by hand always works. When the facilitator has entered an AI key
        of their own, it is not Cloudflare that groups: for that way section 3.5 holds instead of this section.
      </p>
      <p>
        <strong>What goes to the AI service.</strong> The Worker (section 2.1) reads the notes from the wall and sends
        to “Cloudflare Workers AI”, an AI service of Cloudflare, the wall’s question and the text of every note that
        lies in no group a person created by hand or renamed (below, “Without AI”), together with the language the
        headings are to be written in. This happens in several requests: once all these notes together, then in batches
        of 50. When the service has not answered a request after a few seconds, the same request goes out a second time
        beside it, and the first readable answer counts; a request without a usable answer is repeated once. So the same
        texts can go to the service up to four times. The computing is done by a language model that Cloudflare offers
        in this service (currently “Gemma” by Google); which one is a setting of the application and can change.{" "}
        <strong>What does not go along:</strong> who wrote a note, any name, any identifier of a note or a person, where
        a note lies, and the address of the wall: in the text for the model the notes are only numbered. A note can
        itself say something about people, though; whatever it says goes along (section 3.1, free text).
      </p>
      <p>
        <strong>Where, and what Cloudflare does with it.</strong> Where Workers AI computes cannot be bound to the EU:
        the texts may be processed outside the EU. According to Cloudflare, Cloudflare does not train AI models on the
        content Workers AI processes and does not keep inputs and answers longer than needed to answer the request.
      </p>
      <p>
        <strong>What is stored afterwards.</strong> The proposal (groups with headings and which note belongs where)
        goes only to the facilitator’s browser and is stored nowhere. Only when the facilitator chooses “Apply” does the
        wall store the groups and the new places of the notes like any other change, in the Durable Object in the EU;
        everyone on the wall then sees them. In addition the wall keeps, in one row, the state before the last grouping,
        for “Undo”: where every note it moved lay before and in which group, which groups were added and which, with
        their titles, were removed. This row disappears when the grouping is undone, the next grouping overwrites it,
        otherwise it goes with the wall. “Undo” leaves a group that a person has renamed since standing, with its notes.
      </p>
      <p>
        <strong>The counter.</strong> For the limits above the application stores one row for the last 24 hours: the
        computing used or set aside for a run under way (in Cloudflare’s unit “neurons”), in sections of ten minutes,
        and, per wall, the moment of every counted run, to the millisecond, six at most. A run without a proposal is
        taken out again. The wall does not appear in it under its address but under a key computed from it (the first 8
        bytes of a SHA-256 hash): whoever knows the address can compute it, but the address cannot be computed from the
        key. No texts of notes, no names and no IP addresses are in it. The row lies in the same Durable Object as the
        counter of walls, not bound to the EU (section 2.2). Entries older than 24 hours are removed by the application
        the next time it writes the row, that is, at the next run of any wall; until then they stay.
      </p>
      <p>
        <strong>Without AI.</strong> Whoever does not want the notes to go to the AI service groups by hand: grouping
        leaves a group that a person creates untouched, with its notes, and these notes never go to the AI service. So
        does a group of the AI as soon as a person renames it: from then on its notes no longer go out in later runs; in
        the run that created the group, they went out. This holds for renaming from 23 November 2026; a group renamed
        earlier, only once it is renamed again. Not built yet and still only planned is grouping in the browser; when it
        comes, this section is extended. Legal basis as in section 3.7: grouping is a function of the wall that the
        facilitator starts.
      </p>

      <h3 id="eigener-ki-schluessel">3.5 Grouping with your own AI key</h3>
      <p>
        <strong>When.</strong> Only when the facilitator has entered a key of their own for an AI provider under “More”
        (“Own AI key”). “Group notes” then asks this provider instead of Cloudflare; everything else on the wall stays
        as it is. At present the application offers a provider to nobody: it does so only once it has been measured how
        well the provider’s model groups notes, and that has not happened for any of them yet. A tab still shows the
        providers when its address carries the addition <code>#eigener-schluessel</code>; the application takes it out
        of the address at once, and after a reload it no longer holds. The way is described here already.
      </p>
      <p>
        <strong>Where to.</strong> To exactly one recipient, the one the facilitator chose: Mistral AI (
        <code>api.eu.mistral.ai</code>), OpenAI (<code>api.openai.com</code>) or Anthropic (
        <code>api.anthropic.com</code>). The facilitator’s browser sends straight there, not through {app}’s server. The
        application loads no code from there; its security policy (Content-Security-Policy) allows the browser exactly
        these three addresses besides the application itself. The part of the program for this way the browser fetches
        from the application itself at the first run; this request carries nothing of the wall.
      </p>
      <p>
        <strong>Which requests.</strong> First the browser asks the provider by itself whether it takes requests from
        this application (a “preflight”, without the key and without content). Then a run sends one request with all
        notes, after it one per 50 notes, these side by side. When the provider has not answered a request after 15
        seconds (the first) or 12 seconds (the others), the same request goes out a second time beside it, and the first
        readable answer counts; a request without a usable answer is repeated once. So the same texts can go to the
        provider up to four times. When the provider refuses the key, the account or the request itself, the run sends
        no further request.
      </p>
      <p>
        <strong>What each request contains.</strong> The key (in the header <code>Authorization</code>), the name of the
        model, fixed instructions in English (among them the language the headings are to be written in), the wall’s
        question and the texts of the revealed notes that lie in no group a person created or renamed (section 3.4,
        “Without AI”): one numbered line per note, in the order they were written. The requests that assign the notes to
        the themes also carry the themes the provider named in its first answer. In addition the schema of the expected
        answer and technical details go along (such as how long the answer may be at most). As with every request, the
        browser adds: the IP address of the device, <code>Origin</code> (the address of the application, not that of the
        wall), the browser’s identification (User-Agent), the preferred languages (Accept-Language) and, depending on
        the browser, further details about browser and device (client hints). No referrer and no cookies go along. With
        Anthropic alone, headers of Anthropic’s program library are added, which name, among other things, the browser’s
        name and version.
      </p>
      <p>
        <strong>What does not go along:</strong> who wrote a note, any name, any identifier of a note or a person, where
        a note lies, any group, the address or identifier of the wall, the facilitator key and any session key. Whatever
        a note itself says goes along (section 3.1, free text).
      </p>
      <p>
        <strong>What the server of {app} learns of it.</strong> Of the grouping itself nothing: it is not asked, and the
        run counts neither as one of the wall’s runs nor as computing (section 3.4). Only when the facilitator chooses
        “Apply” does their browser send, as otherwise, the groups with their headings and the new places of the notes,
        together with the detail that a key of their own delivered the proposal (<code>source: "key"</code>). The server
        passes this detail on to every browser on the wall and does not store it. Which provider it was neither the
        server nor any other browser learns. What is then stored on the wall is in section 3.4 (“What is stored
        afterwards”).
      </p>
      <p>
        <strong>What stays in the browser.</strong> Nothing is stored, not in the storage of the browser either (section
        4). The key, the chosen provider and the addition from the address lie only in the working memory of the tab; a
        reload or closing the tab removes them, “Remove key” the key. The key is never in an address, a log or an error
        message, and it never goes to the server of {app}.
      </p>
      <p>
        <strong>Cancelling.</strong> “Cancel” ends the open requests, and so does the limit of 120 seconds after which
        the application waits no longer. The provider may still bill the facilitator’s account for what it computed
        until then.
      </p>
      <p>
        <strong>The page for the key.</strong> The link to the provider’s page where a key is created is opened by the
        application only on a click, in a new tab and without a referrer.
      </p>
      <p>
        <strong>What the provider does with it</strong>, by its own statements, read on 23 November 2026; the
        application states the same when the provider is chosen:
      </p>
      <ul>
        <li>
          <strong>Mistral</strong>, by its own statement, computes for the EU address the application calls in data
          centres in countries of the EU and EFTA; data for steering the service may also be processed elsewhere.
          Mistral keeps inputs and answers for up to 30 days to detect abuse, unless Mistral has granted the account use
          without retention (“zero data retention”). Whether Mistral trains on them depends on a setting of the account;
          what holds for paid use while nobody changes it Mistral does not say plainly. Details:{" "}
          <Out href="https://legal.mistral.ai/terms/privacy-policy">Mistral’s privacy policy</Out>.
        </li>
        <li>
          <strong>OpenAI</strong> promises no place. OpenAI keeps abuse-monitoring logs, which may contain inputs and
          answers, for up to 30 days, longer where the law requires it or where it is needed to prevent harm. It does
          not train on them unless the account explicitly opted in. Details:{" "}
          <Out href="https://developers.openai.com/api/docs/guides/your-data">OpenAI’s statement on API data</Out>.
        </li>
        <li>
          <strong>Anthropic</strong> promises no place (“any available geography”). Anthropic deletes inputs and answers
          within 30 days; content its checks flag as violating its usage policy it keeps for up to two years. By default
          Anthropic does not train on them. When the model the application currently asks declines a request, Anthropic
          itself puts it to another of its models (fallback). Accounts with “zero data retention” may not be asked from
          a browser; the application then says that the key was refused. Details:{" "}
          <Out href="https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data">
            Anthropic’s statement on how long it stores data
          </Out>
          .
        </li>
      </ul>
      <p>
        <strong>Who is responsible.</strong> The facilitator sends the notes under their own contract with the provider,
        through their own account there. In the operator’s understanding the provider acts for the facilitator in this
        processing, not for the operator: the operator has no contract with these providers, receives nothing from them
        and does not see what goes there and back. He is responsible for the application that makes the request, that
        is, for what it sends and what it does not (above). Legal basis for that as in section 3.7: grouping is a
        function of the wall that the facilitator starts.
      </p>

      <h3>3.6 The link is the key: please read</h3>
      <p>
        A wall has no access control but its link: the address contains a random identifier that cannot be guessed, and{" "}
        <strong>whoever has the link can join the wall and read everything on it</strong>: the question, the names and,
        once revealed, all notes and groups the server has stored for the wall (section 3.1). Whoever has joined can, by
        the rules of the server, also write notes and, after revealing, move any note and create, change and delete
        groups. Pass the link on to your team only, do not post it in open channels, and keep in mind that it stays in
        chat histories and browser histories. The application itself never passes the link on to third parties and asks
        search engines not to list walls. The QR code of the link (“Show QR code” in the menu “More”) is drawn by your
        browser itself; the link goes to no service for it. The QR code holds only the wall’s link, never the
        facilitator key.
      </p>
      <p>
        Whoever creates a wall also holds a facilitator key, which lies in their browser (section 4). To facilitate the
        wall from another device they can copy a facilitator link, which carries this key behind the <code>#</code> of
        the address, a part that browsers never send to a server; the application stores the key and removes it from the
        address bar as soon as the link is opened. Whoever has the facilitator link facilitates the wall: they can
        delete it, and at their command the server also deletes single notes of other people.
      </p>

      <h3>3.7 Legal basis</h3>
      <p>
        You use a wall because you or your team asked for it; processing the data named above is exactly what is needed
        to provide this wall. The legal basis is therefore Art. 6(1)(b) GDPR (performance of a relationship of use free
        of charge, which comes about by creating or joining), in addition Art. 6(1)(f) GDPR (legitimate interest in
        providing an offer that works and is hard to abuse). For the core function <strong>no consent</strong> is asked
        for and none is needed; this is why there is no consent dialog.
      </p>
      <p>
        If you use {app} as part of your work, your employer may itself be responsible under data protection law for the
        decision to use the tool; this does not affect this notice.
      </p>

      <h2>4. Storage in your browser: no cookies</h2>
      <p>
        The application sets <strong>no cookies</strong>, neither its own nor those of others. Instead it keeps a few
        entries in the storage of your browser (localStorage, one in sessionStorage):
      </p>
      <ul>
        <li>
          <code>ideabeam-walls</code>: the display name you used last; the walls you have created or been on, each with
          its address, the wall’s question, your name there, your session key and the time of your last visit; and, if
          you facilitate a wall, its facilitator key. Without an account this is the only way back onto a wall as the
          same person.
        </li>
        <li>
          <code>ideabeam-view</code>: whether a wall opens in this browser as its surface or as its list. The entry only
          comes into being when you switch, and then holds for every wall in this browser; without it the width of the
          window decides.
        </li>
        <li>
          <code>sb-lang</code>, <code>sb-theme</code>, <code>sb-tone</code>, <code>sb-motion</code>: the language and
          your choice of light or dark, the tone and reduced motion.
        </li>
        <li>
          <code>sb-started</code> (sessionStorage, ends with the tab): that the start screen was already shown in this
          tab.
        </li>
      </ul>
      <p>
        These entries stay until you delete them: a single wall under “My walls” with “Remove from the list”, everything
        through the settings of your browser (delete the website data for the address used). The entry of a wall that no
        longer exists is removed by the application itself once you open that wall’s address, and so is it after “Delete
        my details” (section 3.3). No entries are kept for analytics, advertising or tracking. The browser does not
        attach any of these entries to requests by itself (unlike cookies). The application transmits them in two cases:
        when you join a wall, and at every automatic reconnection, after a break in the network for example, it sends
        the display name, the session key and, if there is one, the facilitator key of this wall to this wall. With
        “Save as Markdown” it sends the session key of this wall to this wall (section 3.1). The entries on appearance
        only come into being when you make the choice, and are never transmitted. An AI key of the facilitator’s own is
        in none of these entries (section 3.5).
      </p>
      <p>
        Storing these entries is exempt from the requirement of consent under § 25(2) no. 2 TDDDG, because it is
        strictly necessary to provide the service you expressly asked for: your wall, your session, your language and
        the appearance you chose. This is why there is no cookie banner.
      </p>

      <h2>5. What does not exist</h2>
      <ul>
        <li>no web analytics, no tracking pixels, no fingerprinting;</li>
        <li>
          no fonts, scripts or stylesheets from other servers (everything is delivered by the application itself);
        </li>
        <li>no advertising, no advertising networks;</li>
        <li>no camera, no microphone, no notifications;</li>
        <li>no profiling, no automated decisions within the meaning of Art. 22 GDPR;</li>
        <li>no merging of data across walls (the operator does not know who uses which walls).</li>
      </ul>
      <p>
        The source code of {app} is published under the AGPL-3.0-or-later; what is said here about the application
        itself can be checked there
        {isPlaceholder(REPO_URL) ? (
          <>
            {" "}
            (<PlaceholderField value={REPO_URL} />)
          </>
        ) : (
          <>
            : <Out href={REPO_URL}>GitHub</Out>
          </>
        )}
        . The settings of the Cloudflare account (no Web Analytics beacon, no bot-protection cookies, no challenge
        pages) are no part of the source code; the operator checked them on{" "}
        <PlaceholderField value={CLOUDFLARE_SETTINGS_CHECKED} />. The footer of the application links to exactly the
        version that is running, on GitHub. Following this link takes you to GitHub, Inc.; the address of a wall is not
        passed along as a referrer.
      </p>

      <h2>6. Recipients and transfer to third countries</h2>
      <p>
        The recipient is <strong>Cloudflare, Inc. (USA)</strong> as a processor: all data from sections 2 and 3, the
        data of the walls stored in data centres in the EU, the connection data at the nearest location, and, when
        grouping, the wall’s question and the texts of the notes in the AI service “Workers AI”, which may also compute
        outside the EU (section 3.4). Basis for the transfer: the EU-US Data Privacy Framework, in addition the standard
        contractual clauses.
      </p>
      <p>
        Only when the facilitator groups with an AI key of their own is there a second recipient: the one provider they
        chose, <strong>Mistral AI</strong> (France), <strong>OpenAI</strong> (USA) or <strong>Anthropic</strong> (USA).
        The facilitator’s browser sends the wall’s question and the texts of the notes straight to it, under the
        facilitator’s contract with this provider, not under one of the operator’s (section 3.5). Whether the provider
        transfers the data to a third country, and on which basis, is a matter of that contract; the operator does not
        know it.
      </p>
      <p>
        Nobody else. The operator passes no data on to further third parties, sells nothing and hands out the content of
        a wall only where the law obliges him to.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Under the GDPR you have the right of access (Art. 15), to rectification (Art. 16), to erasure (Art. 17), to
        restriction of processing (Art. 18), to data portability (Art. 20) and to object to processing based on
        legitimate interest (Art. 21). You can also lodge a complaint with a data protection supervisory authority (Art.
        77), for example the one responsible for the place where you live.
      </p>
      <p>
        The practical side, described honestly: the operator <strong>cannot</strong> tell which person is behind a
        display name. There are no accounts, no e-mail addresses, no IP logs and no directory of walls. A request
        therefore has to name the <strong>link of the wall</strong> (Art. 11 GDPR), otherwise the operator cannot assign
        the data. Then:
      </p>
      <ul>
        <li>
          <strong>Access and data portability:</strong> what the wall holds about you, you see on the wall itself only
          in part (your name and whether you facilitate). Not visible are your session key (it lies in your browser),
          your identifier on the wall, the time of your first join. You see your own notes on the surface and in the
          list in every phase, with the word “Yours”; the others’ after revealing. “Save as Markdown” gives you the
          texts you may see on the wall as a file, without names (section 3.1); what the server holds about you as a
          person is not in it. For complete information send a request that names the wall’s link to <OperatorEmail />.
        </li>
        <li>
          <strong>Rectification:</strong> you cannot change your display name on a wall yourself yet; there is no
          function for it yet. The server changes the text of a note only at the command of the person who wrote it, on
          the surface or in the list with “Edit”. For a rectification send a request that names the wall’s link to{" "}
          <OperatorEmail />.
        </li>
        <li>
          <strong>Erasure:</strong> you delete your own details on the wall itself, with “More” and “Delete my details”;
          your notes stay on the wall, without a name (section 3.3). The server deletes a single note at the command of
          the person who wrote it, or, after revealing, of the facilitator, on the surface or in the list with “Delete”.
          The facilitator can delete the whole wall; otherwise it expires (section 3.3, also on the recovery history of
          the platform). On a request that names the link, the operator deletes the whole wall, because he cannot assign
          single entries to a person.
        </li>
      </ul>
      <p>
        <strong>Right to object (Art. 21 GDPR).</strong> Where data is processed on the basis of Art. 6(1)(f) GDPR
        (hosting, section 2.1; abuse brake and daily budget, section 2.2; additional basis for running the walls,
        section 3.7), you can object at any time on grounds relating to your particular situation: <OperatorEmail />.
        The practical consequence, described honestly: hosting and the abuse brake are parts without which the operator
        cannot run any wall; an objection to them is technically the same as not using the service.
      </p>

      <h2>8. Other matters</h2>
      <p>
        <strong>Children.</strong> The offer is aimed at teams in a work or project context and not at children under
        16. No age is asked for.
      </p>
      <p>
        <strong>No obligation to provide data.</strong> You are obliged neither by law nor by contract to give any data.
        Without a display name, however, you cannot join a wall; it may be a pseudonym. Notes and groups are voluntary.
      </p>
      <p>
        <strong>Address.</strong> {app} runs at ideabeam.de. Beside it there is a preview at an address of Cloudflare
        (it ends in workers.dev), where new versions are tried before they go live. This notice applies there as well.
        The preview has a storage of its own, kept apart: a wall of the preview does not exist at ideabeam.de, and the
        other way round. Your browser keeps the entries of section 4 separately for each address.
      </p>
      <p>
        <strong>If you write.</strong> If you send the operator an e-mail, for example to report content or to ask a
        question, the operator processes your address and your message in order to answer (Art. 6(1)(f) GDPR, the
        legitimate interest in answering enquiries). The message is deleted once the matter is settled, unless a legal
        duty requires keeping it longer. It goes to nobody except the provider of the mailbox.
      </p>
      <p>
        <strong>Changes.</strong> This notice is adapted when the application changes, in particular when a service
        provider is added or dropped. The current version is under <Link to="/datenschutz">“Privacy”</Link> in the
        footer of every view; the date above shows its state. A separate notification is not possible, since there are
        no accounts.
      </p>
    </>
  );
}
