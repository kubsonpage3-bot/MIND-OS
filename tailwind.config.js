/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			inter:   ['Nunito', 'sans-serif'],
  			nunito:  ['Nunito', 'sans-serif'],
  			mono:    ['Press Start 2P', 'monospace'],
  			pixel:   ['Press Start 2P', 'monospace'],
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input:  'hsl(var(--input))',
  			ring:   'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			gf: 'hsl(var(--gf-color))',
  			gc: 'hsl(var(--gc-color))',
  			ps: 'hsl(var(--ps-color))',
  			vm: 'hsl(var(--vm-color))',
  			// Habitica brand
  			'habit-purple':      '#7B61FF',
  			'habit-purple-light':'#e8e4ff',
  			'habit-gold':        '#ffbe5d',
  			'habit-red':         '#f74e52',
  			'habit-blue':        '#50b5e9',
  			'habit-green':       '#1ca830',
  			'habit-orange':      '#ff8800',
  			'habit-sidebar':     '#2b2738',
  			'habit-text':        '#2b2738',
  			'habit-dim':         '#878190',
  			'habit-border':      '#e5e3eb',
  			'habit-bg':          '#f6f6f9',
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to:   { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to:   { height: '0' }
  			},
  			'pulse-glow': {
  				'0%, 100%': { opacity: '1' },
  				'50%': { opacity: '0.6' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up':   'accordion-up 0.2s ease-out',
  			'pulse-glow':     'pulse-glow 2s ease-in-out infinite',
  		}
  	}
  },
  safelist: [
    'bg-gf', 'bg-gc', 'bg-ps', 'bg-vm',
    'text-gf', 'text-gc', 'text-ps', 'text-vm',
    'border-gf', 'border-gc', 'border-ps', 'border-vm',
    'glow-blue', 'glow-green', 'glow-yellow', 'glow-purple', 'glow-white',
    'bg-habit-purple', 'bg-habit-gold', 'bg-habit-red', 'bg-habit-blue',
    'bg-habit-green', 'bg-habit-orange', 'text-habit-purple', 'text-habit-gold',
    'text-habit-red', 'text-habit-blue', 'text-habit-green', 'text-habit-orange',
    'border-habit-purple',
  ],
  plugins: [require("tailwindcss-animate")],
}
