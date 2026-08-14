const modifier = (text) => {

  text = RW_onOutput(text);            // FIRST: the Rewind
  text = GK_onOutput(text);            // verdict captured first
  text = OB_onOutput(text);            // record the ruling (rank as HELD — before SK tallies)
  text = INV_onOutput(text);
  text = SK_onOutput(text);            // tally the settled ruling
  text = TK_onOutput(text);            // drift + check-coupling
  text = EV_onOutput(text);            // settle the intrusion (fire line, fx)
  text = CS_onOutput(text);            // the Sheet renders settled truth
  text = GK_onOutputDebug(text);

  return { text }
}

// Don't modify this part
modifier(text)
