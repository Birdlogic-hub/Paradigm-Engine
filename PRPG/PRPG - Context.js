// @cache-compatible
const modifier = (text) => {

  text = RW_onContext(text);           // FIRST: the Rewind
  text = EV_onContext(text);           // roll + event block (history settled here)
  text = GK_onContext(text);           // the arbiter block — the verdict
                                       // schema keeps the last word
  text = OB_onContext(text);           // read-only fingerprint of what the model sees
  return { text }
}

// Don't modify this part
modifier(text)
