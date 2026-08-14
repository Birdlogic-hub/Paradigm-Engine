const modifier = (text) => {

  text = RW_onInput(text);              // FIRST: the Rewind restores before anyone reads
  text = INV_onInput(text);
  text = GK_onInput(text);

  return { text }
}

// Don't modify this part
modifier(text)