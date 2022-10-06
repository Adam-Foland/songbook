function getRangeForCursor(e) {
  if (document.caretRangeFromPoint) {
    // edge, chrome, android
    range = document.caretRangeFromPoint(e.clientX, e.clientY)
  } else {
    // firefox
    var pos = [e.rangeParent, e.rangeOffset]
    range = document.createRange()
    range.setStart(...pos);
    range.setEnd(...pos);
  }
  return range;
}

function mergeNodeAfter(target, source) {
  let first = source.childNodes[0];
  let documentFragment = document.createDocumentFragment();
  while (source.childNodes.length > 0) {
    documentFragment.appendChild(source.childNodes[0]);
  }
  target.append(documentFragment);
  if (first != null) {
    console.log("Setting cursor before:", first);
    setCursorBefore(first);
  }
  source.remove();
}

function acceptsTextAndChords(element) {
  return element.nodeName="SONG-ROW";
}

function canInsertChord() {
  if (window.getSelection().rangeCount < 1) {return false; }
  let r = window.getSelection().getRangeAt(0);
  let x =
      //acceptsTextAndChords(r.startContainer);
      (r.startContainer.nodeName == '#text'
          && acceptsTextAndChords(r.startContainer.parentNode));
  return x;
}

function insertChordHere(ch) {
  if (canInsertChord()) {
    let chedit = createChord("");
    chedit.setAttribute("editing", "true");
    window.getSelection().getRangeAt(0).insertNode(chedit);
    chedit.focus();
    return true;
  }
  return  false;
}

function setCursorBefore(node) {
  let newr=document.createRange();
  newr.setStartBefore(node);
  newr.setEndBefore(node);
  document.getSelection().removeAllRanges();
  document.getSelection().addRange(newr);
  console.log("New selection:", document.getSelection(), newr);
}

// anchorNode
//     :
//     song-row.accepts-ch
// anchorOffset
//     :
//     0
// baseNode
//     :
//     song-row.accepts-ch
// baseOffset
//     :
//     0
// extentNode
//     :
//     song-row.accepts-ch
// extentOffset
//     :
//     0
// focusNode
//     :
//     song-row.accepts-ch
// focusOffset
//     :
//     0
// isCollapsed
//     :
//     true
// rangeCount
//     :
//     1
// type
//     :
//     "Range"




class SongBody extends HTMLElement {
  constructor() {
    super();

    const template = document.createElement('template');
    template.innerHTML = `
<link rel="stylesheet" href="song.css"/>
<div class="songbody" id="songbody" contenteditable="true"><slot/></div>
  `;

    const shadow = this.attachShadow({ mode: "closed" });
    shadow.appendChild(template.content.cloneNode(true));
    this.body=shadow.getElementById("songbody");

    this.body.addEventListener("mousedown", this.mouseDown);
    this.body.addEventListener("dragover", (e) => {this.dragOver(e, this); });
    this.body.addEventListener("dragstart", (e) => {this.dragStart(e, this); });
    this.body.addEventListener("dragend", (e) => {this.dragEnd(e, this); });
    this.body.addEventListener("drop", (e) => {this.drop(e, this); });
    this.body.addEventListener("keydown", this.keyDown);
  }

  connectedCallback() {
    this.parentNodeBackup = this.parentNode;
    this.beforeInputHandler = (e) => { this.beforeInput(e, this); };
    this.parentNode.addEventListener("beforeinput", this.beforeInputHandler);
    this.inputHandler = (e) => { this.input(e, this); };
    this.parentNode.addEventListener("input", this.inputHandler);
    this.parentNode.addEventListener("keydown", this.keyDown);
    this.pasteHandler = (e) => { this.paste(e, this); };
    this.parentNode.addEventListener("paste", this.pasteHandler);
  }

  disconnectedCallback() {
    if (this.parentNodeBackup) {
      this.parentNodeBackup.removeEventListener("beforeinput", this.beforeInputHandler);
      this.parentNodeBackup.removeEventListener("input", this.inputHandler);
      this.parentNodeBackup.removeEventListener("keydown", this.keyDown);
      this.parentNodeBackup.removeEventListener("paste", this.pasteHandler);
    }
  }

  dragStart(e, songbook) {
    songbook.toRemoveWhenDropped = getSelection().getRangeAt(0).cloneRange();
    e.dataTransfer.effectAllowed="copyMove";
  }
  dragEnd(e, songbook) {
    songbook.toRemoveWhenDropped = null;
  }

  mouseDown(e) {
    if (e.detail > 1 && canInsertChord()) {
      if (insertChordHere("")) {
        e.preventDefault();
      }
    }
  }

  keyDown(e) {
    console.log("keydown...",e, document.getSelection());
    if (e.key == '`' && canInsertChord()) {
      if (insertChordHere("")) {
        e.preventDefault();
      }
    }
    if (e.key == 'Backspace'){
      if (document.getSelection().isCollapsed
          && document.getSelection().rangeCount == 1
          && document.getSelection().type === 'Range') {
        let r = document.getSelection().getRangeAt(0);
        if (r.startOffset < r.startContainer.childNodes.length &&
            r.startContainer.childNodes[r.startOffset].nodeName=='SONG-CH') {
          r.startContainer.childNodes[r.startOffset].remove();
          e.preventDefault();
        }
      }

    }
  }

  dragOver(e, songbook) {
    if (e.dataTransfer.types.includes("songbook/chord")) {
      if (e.altKey) {
        e.dataTransfer.dropEffect = 'copy';
      } else {
        e.dataTransfer.dropEffect = 'move';
      }
      let range = getRangeForCursor(e);
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(range);
      if (!canInsertChord()) {
        e.dataTransfer.dropEffect = 'none';
      };
      e.preventDefault();
    }
  }

  drop(e, songbody) {
    let d = e.dataTransfer.getData("songbook/chord");
    if (d != null && d != "") {
      let range = getRangeForCursor(e)
      if (acceptsTextAndChords(range.commonAncestorContainer.parentNode)) {
        range.insertNode(createChord(d));
        songbody.dropped = true;
      }
      e.preventDefault();
      return;
    }

    d = e.dataTransfer.getData("text/html");
    if (d != null && d != "") {
      console.log("Special!!!", e.dataTransfer.dropEffect);

      if ((e.dataTransfer.dropEffect === 'move'
              || !e.altKey) &&
          songbody.toRemoveWhenDropped != null) {
        songbody.toRemoveWhenDropped.deleteContents();
      }

      let range = getRangeForCursor(e)
      let span = document.createElement("span");
      span.innerHTML=d;
      range.insertNode(span);
      Sanitize(songbody);
      e.preventDefault();

      //songbody.dropped = true;

      return;
    }
    // console.log("On drop: ", e);
    // e.dataTransfer.types.forEach(
    //     (t) =>
    //     {
    //       console.log(t, e.dataTransfer.getData(t));
    //     }
    // );
  }

  beforeInput(e, songbody) {
    console.log("BEFORE");
    if (e.inputType == "deleteContentBackward") {
      if (document.getSelection().rangeCount == 1
          && document.getSelection().isCollapsed) {
        let r = document.getSelection().getRangeAt(0);
        console.log(document.getSelection(), r.startContainer.nodeName, r.startContainer, r.startOffset)
        // If the previous element is chord, we want to skip and remove the prev letter.
        if (r.startContainer.nodeName == '#text' && r.startOffset == 0
            && r.startContainer.previousSibling != null
            && r.startContainer.previousSibling.nodeName === 'SONG-CH') {
          setCursorBefore(r.startContainer.previousSibling);
          r = document.getSelection().getRangeAt(0);
          // We want to continue in case we want to merge rows.
        }
        // If we are after the trailing space... we want to remove it as well.
        if (r.startContainer.nodeName == '#text' && r.startOffset == 1
            && r.startContainer.previousSibling == null
            && r.startContainer.nodeValue.startsWith(nbsp)) {
          r.startContainer.nodeValue = r.startContainer.nodeValue.substring(1);
          if (r.startContainer.parentNode.previousSibling != null) {
            mergeNodeAfter(r.startContainer.parentNode.previousSibling,
                r.startContainer.parentNode);
            e.preventDefault();
          } else {
            alert("not yet coded1");
          }
        }
        // When we are at the beginning of the ROW, we merge the rows.
        if (r.startContainer.nodeName == 'SONG-ROW' && r.startOffset == 0) {
          if (r.startContainer.previousSibling != null
              && r.startContainer.previousSibling.nodeName === 'SONG-ROW') {
            // There is previous line:
            mergeNodeAfter(r.startContainer.previousSibling, r.startContainer);
            e.preventDefault();
          } if (r.startContainer.previousSibling != null
              && r.startContainer.previousSibling.nodeName === 'SONG-BIS') {
            // Previous line is within bis.
            mergeNodeAfter(r.startContainer.previousSibling.childNodes[0].lastChild, r.startContainer);
            e.preventDefault();
          } else if (r.startContainer.previousSibling == null
              && r.startContainer.parentNode.parentNode != null
              && r.startContainer.parentNode.parentNode.nodeName === 'SONG-BIS'
              && r.startContainer.parentNode.parentNode.previousSibling != null
              && r.startContainer.parentNode.parentNode.previousSibling.nodeName == 'SONG-ROW' ) {
            // Previous line is outside of bis.
            mergeNodeAfter(r.startContainer.parentNode.parentNode.previousSibling,
                r.startContainer);
            e.preventDefault();
          } else if (r.startContainer.previousSibling == null
              && r.startContainer.parentNode.parentNode.previousSibling != null
              && r.startContainer.parentNode.parentNode.previousSibling.nodeName === 'SONG-VERSE') {
            // Previous line is in another verse.
            mergeNodeAfter(r.startContainer.parentNode.parentNode.previousSibling.childNodes[0],
                r.startContainer.parentNode);
            r.startContainer.remove();
            e.preventDefault();
          }
        }
        if (r.startContainer.nodeName == 'SONG-ROW' && r.startOffset == 1) {
          if (r.startContainer.previousSibling != null
              && r.startContainer.previousSibling.nodeName === 'SONG-ROW'
              && r.startContainer.childNodes[0].nodeName==='#text'
              && r.startContainer.childNodes[0].nodeValue===nbsp) {
            r.startContainer.childNodes[0].remove();
            mergeNodeAfter(r.startContainer.previousSibling, r.startContainer);
            e.preventDefault();
          }
        }
        // When we are at the beginning of the ROW, we merge the rows.
        if (r.startContainer.nodeName == '#text' && r.startOffset == 0) {
          if (r.startContainer.previousSibling == null
              && r.startContainer.parentNode.nodeName === 'SONG-ROW'
              &&  r.startContainer.parentNode.previousSibling.nodeName === 'SONG-ROW') {
            mergeNodeAfter(r.startContainer.parentNode.previousSibling, r.startContainer.parentNode);
            e.preventDefault();
          }
        }

        r= document.getSelection().getRangeAt(0);
        if (r.startContainer.nodeName === 'SONG-ROWS'
            || r.startContainer.nodeName === 'SONG-VERSE'
            || r.startContainer.nodeName === 'SONG-BIS'
            || r.startContainer.nodeName === 'SONG-BODY') {
          console.log("Preventing deletion of whole: ", r);
          if (r.startContainer.childNodes[r.startOffset] != null
            && r.startContainer.childNodes[r.startOffset].firstChild != null) {
            setCursorBefore(
                r.startContainer.childNodes[r.startOffset].firstChild);
          }
          e.preventDefault();
        }
      }
      Sanitize(songbody);
    }
  }

  input(e, songbody) {
    console.log("Oninput", e);
    Sanitize(songbody);
//    Avoid keeping cursor before the artifical space:
    if (document.getSelection().isCollapsed
        && document.getSelection().rangeCount == 1) {
      let r = document.getSelection().getRangeAt(0);
      //console.log("ON INPUT", document.getSelection(), r.startContainer.nodeName, r.startOffset, r.startContainer);
      if (r.startContainer.nodeName === "#text"
          && r.startOffset == 0
          && r.startContainer.nodeValue.startsWith(nbsp)
          && r.startContainer.previousSibling == null) {
        let newr = document.createRange();
        newr.setStart(r.startContainer, 1);
        document.getSelection().removeAllRanges();
        document.getSelection().addRange(newr);
      }
    }
  }

  paste(e, songbody) {
    console.log(e);
    let p = document.createElement("span");
    p.innerHTML  = e.clipboardData.getData("text/html");
    getSelection().getRangeAt(0).insertNode(p);
    e.preventDefault();
    Sanitize(songbody);
  }

  attributeChangedCallback() {
    console.log("onChange", this);
  }
}

function SongBodyInit() {
  customElements.define("song-body", SongBody);
};

function createSongBody() {
  return document.createElement("song-body");
}