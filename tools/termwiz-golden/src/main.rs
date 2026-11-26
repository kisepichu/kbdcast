// Prints what termwiz (the key encoder of the WezTerm terminal layer) sends for each key of the kbdcast
// key codec's golden table. tools/gen-key-golden.ts turns the output into test/key_golden.emel.
//
// One line per key and modifier combination, separated by tabs:
//   <key> <mods> <hex of the bytes in each of the 12 modes>
// <key> is `U+XXXX` for a character, or the name of a special key. <mods> is the xterm modifier bits
// (1 Shift, 2 Alt, 4 Ctrl). The modes are in the order of `modes()`.
use termwiz::input::{KeyCode, KeyCodeEncodeModes, KeyboardEncoding, Modifiers};

const SPECIAL: [(&str, KeyCode); 14] = [
    ("Enter", KeyCode::Enter),
    ("Esc", KeyCode::Escape),
    ("Tab", KeyCode::Tab),
    ("Backspace", KeyCode::Backspace),
    ("Delete", KeyCode::Delete),
    ("Insert", KeyCode::Insert),
    ("Up", KeyCode::UpArrow),
    ("Down", KeyCode::DownArrow),
    ("Left", KeyCode::LeftArrow),
    ("Right", KeyCode::RightArrow),
    ("Home", KeyCode::Home),
    ("End", KeyCode::End),
    ("PageUp", KeyCode::PageUp),
    ("PageDown", KeyCode::PageDown),
];

// The printable ASCII characters, three characters outside ASCII (2, 3 and 4 bytes of UTF-8), the special keys and F1 to F12.
fn keys() -> Vec<(String, KeyCode)> {
    let code_points = (0x20u32..=0x7e).chain([0xe9, 0x3042, 0x1f600]);
    let chars = code_points.map(|c| (format!("U+{:04X}", c), KeyCode::Char(char::from_u32(c).unwrap())));
    let special = SPECIAL.iter().map(|(name, code)| (name.to_string(), *code));
    let function = (1u8..=12).map(|n| (format!("F{}", n), KeyCode::Function(n)));
    chars.chain(special).chain(function).collect()
}

fn mods(bits: u8) -> Modifiers {
    let mut mods = Modifiers::NONE;
    if bits & 1 != 0 {
        mods |= Modifiers::SHIFT;
    }
    if bits & 2 != 0 {
        mods |= Modifiers::ALT;
    }
    if bits & 4 != 0 {
        mods |= Modifiers::CTRL;
    }
    mods
}

// DECCKM (Normal, Application) × LNM (Cr, CrLf) × modifyOtherKeys (Off, Level1, Level2), the last one varying fastest.
fn modes() -> Vec<KeyCodeEncodeModes> {
    let mut all = Vec::new();
    for application_cursor_keys in [false, true] {
        for newline_mode in [false, true] {
            for modify_other_keys in [None, Some(1), Some(2)] {
                all.push(KeyCodeEncodeModes {
                    encoding: KeyboardEncoding::Xterm,
                    application_cursor_keys,
                    newline_mode,
                    modify_other_keys,
                });
            }
        }
    }
    all
}

fn hex(s: &str) -> String {
    s.bytes().map(|b| format!("{:02x}", b)).collect()
}

fn main() {
    let modes = modes();
    for (name, code) in keys() {
        for bits in 0u8..8 {
            let encoded: Vec<String> = modes
                .iter()
                .map(|m| hex(&code.encode(mods(bits), *m, true).expect("termwiz could not encode the key")))
                .collect();
            println!("{}\t{}\t{}", name, bits, encoded.join("\t"));
        }
    }
}
