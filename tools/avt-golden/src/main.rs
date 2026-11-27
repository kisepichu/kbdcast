// What avt 0.18.0 (the terminal emulator of agg 1.9.0) makes of terminal output, for the kbdcast VT's golden tables.
// tools/gen-vt-golden.ts turns the output into src/vt/width_table.emel and test/vt_golden.emel.
//
//   avt-golden width                 one line per range of code points that avt draws two columns wide:
//                                    `<first>\t<last>` in hex
//   avt-golden cases [seed] [count]  one line per case: `<name>\t<cols>\t<rows>\t<input>\t<snapshot>`, where the
//                                    input and the snapshot are code points in hex separated by `.` (so that no
//                                    character needs escaping). The table uses the default seed and count; other
//                                    values are for exploring.
//
// The snapshot is the screen as agg sees it (`Snapshot::same_visual` in agg: the cells of the view and the cursor),
// plus the cursor keys mode. Its lines, joined by "\n":
//   `cursor <col> <row>` or `cursor hidden`
//   `keys normal` or `keys application`
//   one line per row of the view: for each cell, `\u{1}<pen>\u{2}` when its pen differs from the cell before it
//   (the first cell is compared with the default pen), then the character, or `\u{3}` for the right half of a wide
//   character. <pen> is `<fg>,<bg>,<intensity>,<attrs>`: a color is `-`, `i<index>` or `#rrggbb` (lower-case hex),
//   the intensity is `n`, `b` or `f`, and the attributes are the letters of italic `i`, underline `u`,
//   strikethrough `s`, blink `k` and inverse `r` that are set, in that order.
use avt::{Color, Pen, Vt};
use unicode_width::UnicodeWidthChar;

const DEFAULT_SEED: u64 = 20261127;
const DEFAULT_COUNT: usize = 2000;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("width") => width(),
        Some("cases") => {
            let seed = args.get(2).map_or(DEFAULT_SEED, |s| s.parse().expect("the seed is a number"));
            let count = args.get(3).map_or(DEFAULT_COUNT, |s| s.parse().expect("the count is a number"));
            cases(seed, count)
        }
        _ => {
            eprintln!("usage: avt-golden width | avt-golden cases [seed] [count]");
            std::process::exit(2);
        }
    }
}

// avt's Line::char_display_width: a character is two columns wide when it is above U+007E and unicode-width says 2.
fn width() {
    let mut start: Option<u32> = None;
    for c in 0x7fu32..=0x11_0000 {
        let wide = char::from_u32(c).is_some_and(|ch| ch.width() == Some(2));
        match (wide, start) {
            (true, None) => start = Some(c),
            (false, Some(s)) => {
                println!("{:x}\t{:x}", s, c - 1);
                start = None;
            }
            _ => {}
        }
    }
}

fn hex(s: &str) -> String {
    s.chars().map(|c| format!("{:x}", c as u32)).collect::<Vec<_>>().join(".")
}

fn color(c: Option<Color>) -> String {
    match c {
        None => "-".to_string(),
        Some(Color::Indexed(n)) => format!("i{}", n),
        Some(Color::RGB(rgb)) => format!("#{:02x}{:02x}{:02x}", rgb.r, rgb.g, rgb.b),
    }
}

fn pen(p: &Pen) -> String {
    let intensity = if p.is_bold() {
        "b"
    } else if p.is_faint() {
        "f"
    } else {
        "n"
    };
    let flags = [
        (p.is_italic(), 'i'),
        (p.is_underline(), 'u'),
        (p.is_strikethrough(), 's'),
        (p.is_blink(), 'k'),
        (p.is_inverse(), 'r'),
    ];
    let attrs: String = flags.iter().filter(|(on, _)| *on).map(|(_, c)| *c).collect();
    format!("{},{},{},{}", color(p.foreground()), color(p.background()), intensity, attrs)
}

fn snapshot(vt: &Vt) -> String {
    let cursor = vt.cursor();
    let mut lines = vec![
        if cursor.visible { format!("cursor {} {}", cursor.col, cursor.row) } else { "cursor hidden".to_string() },
        format!("keys {}", if vt.cursor_key_app_mode() { "application" } else { "normal" }),
    ];
    let default = Pen::default();
    for line in vt.view() {
        let mut out = String::new();
        let mut previous = default;
        for cell in line.cells() {
            if *cell.pen() != previous {
                out.push('\u{1}');
                out.push_str(&pen(cell.pen()));
                out.push('\u{2}');
                previous = *cell.pen();
            }
            if cell.width() == 0 {
                out.push('\u{3}')
            } else {
                out.push(cell.char())
            }
        }
        lines.push(out);
    }
    lines.join("\n")
}

fn run(name: &str, cols: usize, rows: usize, input: &str) {
    let mut vt = Vt::builder().size(cols, rows).scrollback_limit(0).build();
    vt.feed_str(input);
    println!("{}\t{}\t{}\t{}\t{}", name, cols, rows, hex(input), hex(&snapshot(&vt)));
}

// SplitMix64: a fixed seed gives the same cases on every machine.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9e37_79b9_7f4a_7c15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
        z ^ (z >> 31)
    }

    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }

    fn pick<'a>(&mut self, xs: &[&'a str]) -> &'a str {
        xs[self.below(xs.len())]
    }
}

const TEXT: [&str; 14] = ["a", "b", "xyz", " ", "hello", "0123456789", "~", "あ", "漢字", "😀", "가", "é", "e\u{301}", "qx"];
const CONTROLS: [&str; 10] = ["\u{8}", "\t", "\n", "\r", "\u{b}", "\u{c}", "\u{e}", "\u{f}", "\u{7}", "\u{0}"];
const ESCAPES: [&str; 16] = [
    "\u{1b}7", "\u{1b}8", "\u{1b}D", "\u{1b}E", "\u{1b}M", "\u{1b}H", "\u{1b}c", "\u{1b}(0", "\u{1b}(B", "\u{1b})0",
    "\u{1b})B", "\u{1b}#8", "\u{1b}=", "\u{1b}>", "\u{1b}", "\u{1b}[",
];
const FINALS: [&str; 33] = [
    "@", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "P", "S", "T", "W", "X", "Z", "`", "a", "b",
    "d", "e", "f", "g", "h", "l", "r", "s", "u", "t",
];
const NUMBERS: [&str; 12] = ["", "0", "1", "2", "3", "4", "5", "7", "9", "20", "100", "65535"];
const MODES: [&str; 12] = ["1", "4", "6", "7", "20", "25", "47", "1047", "1048", "1049", "2004", "9999"];
const SGR: [&str; 30] = [
    "0", "1", "2", "3", "4", "5", "7", "9", "21", "22", "23", "24", "25", "27", "29", "31", "37", "39", "42", "49",
    "91", "107", "38;5;196", "48;5;17", "38;2;10;200;30", "48;2;0;0;255", "38:2::1:2:3", "38:5:100", "", "1;31;44",
];
const OTHER: [&str; 10] = [
    "\u{1b}]0;title\u{7}", "\u{1b}]2;t\u{1b}\\", "\u{1b}P1$q\u{1b}\\", "\u{1b}[!p", "\u{1b}[>4;2m", "\u{1b}[?u",
    "\u{1b}[c", "\u{1b}[6n", "\u{9b}2J", "\u{1b}[1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17H",
];

fn token(rng: &mut Rng, out: &mut String) {
    match rng.below(10) {
        0..=2 => out.push_str(rng.pick(&TEXT)),
        3 => out.push_str(rng.pick(&CONTROLS)),
        4 => out.push_str(rng.pick(&ESCAPES)),
        5 | 6 => {
            out.push_str("\u{1b}[");
            for i in 0..rng.below(3) {
                if i > 0 {
                    out.push(';');
                }
                out.push_str(rng.pick(&NUMBERS));
            }
            out.push_str(rng.pick(&FINALS));
        }
        7 => {
            out.push_str("\u{1b}[");
            if rng.below(2) == 0 {
                out.push('?');
            }
            out.push_str(rng.pick(&MODES));
            out.push_str(if rng.below(2) == 0 { "h" } else { "l" });
        }
        8 => {
            out.push_str("\u{1b}[");
            out.push_str(rng.pick(&SGR));
            out.push('m');
        }
        _ => out.push_str(rng.pick(&OTHER)),
    }
}

// Hand-written cases name the behaviors that the random cases may reach only by chance.
const NAMED: [(&str, usize, usize, &str); 12] = [
    ("print-and-wrap", 5, 3, "abcdefghijkl"),
    ("wide-at-last-column", 5, 2, "abcdあ"),
    ("wide-over-wide-tail", 6, 2, "あい\u{1b}[1Gx\u{1b}[4Gy"),
    ("no-autowrap", 4, 2, "\u{1b}[?7labcdef"),
    ("scroll-region", 4, 4, "1\r\n2\r\n3\r\n4\u{1b}[2;3r\u{1b}[3;1H\n\nX"),
    ("alt-screen", 4, 2, "main\u{1b}[?1049halt\u{1b}[?1049l"),
    ("insert-mode", 6, 1, "abc\u{1b}[1G\u{1b}[4hXY"),
    ("dec-graphics", 6, 1, "\u{1b}(0lqqk\u{1b}(Bq"),
    ("sgr-colors", 6, 1, "\u{1b}[1;31ma\u{1b}[38;5;100mb\u{1b}[48;2;1;2;3mc\u{1b}[0md"),
    ("hide-cursor", 3, 1, "\u{1b}[?25l"),
    ("tabs", 20, 1, "a\tb\u{1b}[3g\u{1b}[5G\u{1b}H\r\tc"),
    ("erase-with-pen", 5, 2, "abcde\u{1b}[44m\u{1b}[1;3H\u{1b}[K\u{1b}[2J"),
];

fn cases(seed: u64, count: usize) {
    for (name, cols, rows, input) in NAMED {
        run(name, cols, rows, input);
    }
    let mut rng = Rng(seed);
    for i in 0..count {
        let cols = 1 + rng.below(10);
        let rows = 1 + rng.below(6);
        let mut input = String::new();
        for _ in 0..1 + rng.below(40) {
            token(&mut rng, &mut input);
        }
        run(&format!("random-{}", i), cols, rows, &input);
    }
}
