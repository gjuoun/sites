" Bigface — https://github.com/gjuoun/bigface-theme
" Install: copy to ~/.vim/colors/bigface.vim (or ~/.config/nvim/colors/), then `:colorscheme bigface`.
hi clear
if exists("syntax_on") | syntax reset | endif
set background=dark
if has('termguicolors') | set termguicolors | endif
let g:colors_name = "bigface"

let g:terminal_ansi_colors = ['#3c403c', '#fc5d23', '#00c853', '#ffeb3b', '#00b0ff', '#ae81ff', '#66d9ef', '#e8e9e1', '#8c8f89', '#fc5d23', '#c6ff00', '#ffeb3b', '#40c4ff', '#ae81ff', '#b3e5fc', '#e8e9e1']

hi Normal guifg=#e8e9e1 guibg=#252925 gui=NONE cterm=NONE
hi NonText guifg=#3c403c guibg=NONE gui=NONE cterm=NONE
hi EndOfBuffer guifg=#252925 guibg=NONE gui=NONE cterm=NONE
hi Cursor guifg=#252925 guibg=#e8e9e1 gui=NONE cterm=NONE
hi CursorLine guifg=NONE guibg=#4b4e49 gui=NONE cterm=NONE
hi CursorLineNr guifg=#e8e9e1 guibg=#4b4e49 gui=NONE cterm=NONE
hi LineNr guifg=#8c8f89 guibg=#252925 gui=NONE cterm=NONE
hi SignColumn guifg=NONE guibg=#252925 gui=NONE cterm=NONE
hi ColorColumn guifg=NONE guibg=#3c403c gui=NONE cterm=NONE
hi VertSplit guifg=#3c403c guibg=#252925 gui=NONE cterm=NONE
hi WinSeparator guifg=#3c403c guibg=#252925 gui=NONE cterm=NONE
hi Visual guifg=NONE guibg=#4b4e49 gui=NONE cterm=NONE
hi Search guifg=#e8e9e1 guibg=#4b4e49 gui=NONE cterm=NONE
hi IncSearch guifg=#252925 guibg=#fc5d23 gui=NONE cterm=NONE
hi MatchParen guifg=#e8e9e1 guibg=#4b4e49 gui=NONE cterm=NONE
hi Pmenu guifg=#e8e9e1 guibg=#4b4e49 gui=NONE cterm=NONE
hi PmenuSel guifg=#e8e9e1 guibg=#4b4e49 gui=NONE cterm=NONE
hi StatusLine guifg=#8c8f89 guibg=#3c403c gui=NONE cterm=NONE
hi StatusLineNC guifg=#8c8f89 guibg=#3c403c gui=NONE cterm=NONE
hi TabLine guifg=#8c8f89 guibg=#3c403c gui=NONE cterm=NONE
hi TabLineSel guifg=#e8e9e1 guibg=#252925 gui=NONE cterm=NONE
hi TabLineFill guifg=NONE guibg=#3c403c gui=NONE cterm=NONE
hi Folded guifg=#8c8f89 guibg=#4b4e49 gui=NONE cterm=NONE
hi ErrorMsg guifg=#fc5d23 guibg=#252925 gui=bold cterm=bold
hi WarningMsg guifg=#ffeb3b guibg=NONE gui=NONE cterm=NONE
hi Directory guifg=#00b0ff guibg=NONE gui=NONE cterm=NONE
hi Title guifg=#c6ff00 guibg=NONE gui=bold cterm=bold

hi Comment guifg=#8c8f89 guibg=NONE gui=italic cterm=italic
hi Constant guifg=#ae81ff guibg=NONE gui=NONE cterm=NONE
hi String guifg=#ffeb3b guibg=NONE gui=NONE cterm=NONE
hi Character guifg=#ffeb3b guibg=NONE gui=NONE cterm=NONE
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
hi Delimiter guifg=#e8e9e1 guibg=NONE gui=NONE cterm=NONE
hi Tag guifg=#40c4ff guibg=NONE gui=NONE cterm=NONE
hi Underlined guifg=#00b0ff guibg=NONE gui=underline cterm=underline
hi Error guifg=#fc5d23 guibg=NONE gui=NONE cterm=NONE
hi Todo guifg=#fc5d23 guibg=NONE gui=bold cterm=bold
hi DiffAdd guifg=#00c853 guibg=#4b4e49 gui=NONE cterm=NONE
hi DiffDelete guifg=#fc5d23 guibg=#4b4e49 gui=NONE cterm=NONE
hi DiffChange guifg=#40c4ff guibg=#4b4e49 gui=NONE cterm=NONE
hi DiffText guifg=#e8e9e1 guibg=#4b4e49 gui=NONE cterm=NONE
