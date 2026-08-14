const modifier = (text) => {

  text = RW_onInput(text);              // FIRST: the Rewind restores before anyone reads
  text = INV_onInput(text);
  text = GK_onInput(text);
  text = TK_onInput(text);              // /track (bookkeeping; the Check yields)
  text = EV_onInput(text);              // /event + Turn-1 card (the roll lives at context, v0.1.1)
  text = CS_onInput(text);              // rule 11: the Sheet exists from Turn 1
  text = OB_onInput(text);              // /telemetry + the ring exists from Turn 1

  return { text }
}

// Don't modify this part
modifier(text)
