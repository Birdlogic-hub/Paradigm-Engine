// @cache-compatible
const modifier = (text) => {
  
  text = RW_onContext(text);
  text = GK_onContext(text);
  
  return { text }
}

// Don't modify this part
modifier(text)