" Bigface — https://github.com/gjuoun/bigface-theme
" Install: copy to ~/.vim/colors/bigface.vim (or ~/.config/nvim/colors/), then `:colorscheme bigface`.
hi clear
if exists("syntax_on") | syntax reset | endif
set background=dark
if has('termguicolors') | set termguicolors | endif
let g:colors_name = "bigface"

let g:terminal_ansi_colors = ['#494848', '#fc5d23', '#00c853', '#e5e500', '#00b0ff', '#ae81ff', '#66d9ef', '#d9d9d4', '#6e6b68', '#fc5d23', '#c6ff00', '#ffeb3b', '#40c4ff', '#ae81ff', '#b3e5fc', '#f8f8f0']

hi Normal guifg=#d9d9d4 guibg=#252925 gui=NONE cterm=NONE
hi NonText guifg=#494848 guibg=NONE gui=NONE cterm=NONE
hi EndOfBuffer guifg=#252925 guibg=NONE gui=NONE cterm=NONE
hi Cursor guifg=#252925 guibg=#f8f8f0 gui=NONE cterm=NONE
hi CursorLine guifg=NONE guibg=#3b3c32 gui=NONE cterm=NONE
hi CursorLineNr guifg=#d9d9d4 guibg=#3b3c32 gui=NONE cterm=NONE
hi LineNr guifg=#6e6b68 guibg=#252925 gui=NONE cterm=NONE
hi SignColumn guifg=NONE guibg=#252925 gui=NONE cterm=NONE
hi ColorColumn guifg=NONE guibg=#333333 gui=NONE cterm=NONE
hi VertSplit guifg=#333333 guibg=#252925 gui=NONE cterm=NONE
hi WinSeparator guifg=#333333 guibg=#252925 gui=NONE cterm=NONE
hi Visual guifg=NONE guibg=#646464 gui=NONE cterm=NONE
hi Search guifg=#d9d9d4 guibg=#646464 gui=NONE cterm=NONE
hi IncSearch guifg=#252925 guibg=#fc5d23 gui=NONE cterm=NONE
hi MatchParen guifg=#d9d9d4 guibg=#3b514d gui=NONE cterm=NONE
hi Pmenu guifg=#d9d9d4 guibg=#3b3c32 gui=NONE cterm=NONE
hi PmenuSel guifg=#d9d9d4 guibg=#3b514d gui=NONE cterm=NONE
hi StatusLine guifg=#75715e guibg=#333333 gui=NONE cterm=NONE
hi StatusLineNC guifg=#6e6b68 guibg=#333333 gui=NONE cterm=NONE
hi TabLine guifg=#6e6b68 guibg=#333333 gui=NONE cterm=NONE
hi TabLineSel guifg=#d9d9d4 guibg=#252925 gui=NONE cterm=NONE
hi TabLineFill guifg=NONE guibg=#333333 gui=NONE cterm=NONE
hi Folded guifg=#75715e guibg=#3b3c32 gui=NONE cterm=NONE
hi ErrorMsg guifg=#fc5d23 guibg=#252925 gui=bold cterm=bold
hi WarningMsg guifg=#ffeb3b guibg=NONE gui=NONE cterm=NONE
hi Directory guifg=#00b0ff guibg=NONE gui=NONE cterm=NONE
hi Title guifg=#c6ff00 guibg=NONE gui=bold cterm=bold

hi Comment guifg=#75715e guibg=NONE gui=italic cterm=italic
hi Constant guifg=#ae81ff guibg=NONE gui=NONE cterm=NONE
hi String guifg=#e5e500 guibg=NONE gui=NONE cterm=NONE
hi Character guifg=#e5e500 guibg=NONE gui=NONE cterm=NONE
hi Number guifg=#fc5d23 guibg=NONE gui=NONE cterm=NONE
hi Boolean guifg=#ae81ff guibg=NONE gui=NONE cterm=NONE
hi Float guifg=#fc5d23 guibg=NONE gui=NONE cterm=NONE
hi Identifier guifg=#00c853 guibg=NONE gui=NONE cterm=NONE
hi Function guifg=#c6ff00 guibg=NONE gui=NONE cterm=NONE
hi Statement guifg=#00b0ff guibg=NONE gui=NONE cterm=NONE
hi Conditional guifg=#00b0ff guibg=NONE gui=NONE cterm=NONE
hi Repeat guifg=#00b0ff guibg=NONE gui=NONE cterm=NONE
hi Keyword guifg=#00b0ff guibg=NONE gui=NONE cterm=NONE
hi Operator guifg=#ffeb3b guibg=NONE gui=NONE cterm=NONE
hi PreProc guifg=#00b0ff guibg=NONE gui=NONE cterm=NONE
hi Type guifg=#66d9ef guibg=NONE gui=NONE cterm=NONE
hi StorageClass guifg=#00b0ff guibg=NONE gui=NONE cterm=NONE
hi Special guifg=#40c4ff guibg=NONE gui=NONE cterm=NONE
hi Delimiter guifg=#d9d9d4 guibg=NONE gui=NONE cterm=NONE
hi Tag guifg=#40c4ff guibg=NONE gui=NONE cterm=NONE
hi Underlined guifg=#00b0ff guibg=NONE gui=underline cterm=underline
hi Error guifg=#fc5d23 guibg=NONE gui=NONE cterm=NONE
hi Todo guifg=#fc5d23 guibg=NONE gui=bold cterm=bold
hi DiffAdd guifg=#00c853 guibg=#3b3c32 gui=NONE cterm=NONE
hi DiffDelete guifg=#fc5d23 guibg=#3b3c32 gui=NONE cterm=NONE
hi DiffChange guifg=#40c4ff guibg=#3b3c32 gui=NONE cterm=NONE
hi DiffText guifg=#d9d9d4 guibg=#3b514d gui=NONE cterm=NONE
