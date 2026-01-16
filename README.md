# Mesh — Minimal Speedcubing Timer

A production-ready, offline-first speedcubing timer focused on identifying inefficiencies without interrupting practice.

## Features

- **csTimer-style interface** — Familiar, minimal design
- **WCA scrambles** — Standard 3x3 move generation
- **Inspection mode** — Optional 15-second countdown
- **Mesh Bar** — Optional 2-second phase split visualization
- **Optional metrics** — Track cross moves, rotations, pauses
- **Session management** — Multiple session types (Normal, Cross-only, F2L, LL)
- **Goal mode** — Compare against Sub-20/15/10/5/3 benchmarks
- **Analytics** — Session breakdown and efficiency stats
- **Offline-first** — Full localStorage persistence
- **Export/Import** — JSON data portability

## Deployment

### Netlify (Recommended)

1. Create new site in Netlify
2. Upload all files:
   - `index.html`
   - `style.css`
   - `main.js`
   - `netlify.toml`
3. Deploy

### Static Server

Serve files from any static host. No build process required.

```bash
# Local development
python -m http.server 8000
# or
npx serve .
```

## Usage

### Timer Controls

- **Space** — Hold to ready, release to start
- **Space (running)** — Stop timer
- **Inspection toggle** — Enable/disable 15s countdown

### Mesh Bar (Optional)

After each solve, a 2-second bar appears showing estimated phase splits:
- **Cross** — First ~20% of solve
- **F2L** — Middle ~45% of solve  
- **LL** — Final ~35% of solve

Drag dividers to adjust estimates. Ignored if untouched.

### Optional Metrics

After Mesh bar, optionally record:
- Cross move count
- Cross rotations (0-3)
- F2L rotations (0-6)
- Major F2L pause (yes/no)
- LL recognition delay (yes/no)

Press "Skip" to save solve without metrics.

### Sessions

- **Normal** — Standard practice
- **Cross-only** — Focus on first layer
- **F2L Slow** — Deliberate pair practice
- **Last Layer** — Algorithm execution

Statistics and controls remain identical across session types.

### Goal Mode

Select target (Sub-20, Sub-15, Sub-10, Sub-5, Sub-3) to compare:
- Phase time requirements
- Rotation targets
- Your current averages

### Analytics

View session breakdown:
- Phase time percentages
- Average cross moves
- Average rotations  
- Pause frequency

## Data Management

All data stored in browser localStorage. No accounts or cloud sync.

**Export:** Download JSON backup of all sessions
**Import:** Restore from JSON file

## Technical Details

- **Stack:** Vanilla JS, zero dependencies
- **Size:** ~30KB total (uncompressed)
- **Timing:** Sub-10ms precision using `performance.now()`
- **Storage:** LocalStorage only
- **Offline:** Full functionality without network
- **Browser:** Modern browsers (Chrome, Firefox, Safari, Edge)

## Performance

- Loads in <100ms
- No external API calls
- No tracking or analytics
- Minimal animations
- Keyboard-first UX

## License

MIT
