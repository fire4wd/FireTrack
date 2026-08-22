#!/bin/bash
# Crea icone valide per tutte le densità

cd ~/coding/FireTrack/android/app/src/main/res/

# Dimensione per ogni densità
# mdpi: 48x48
# hdpi: 72x72
# xhdpi: 96x96
# xxhdpi: 144x144
# xxxhdpi: 192x192

# Crea un'icona rossa con una "F" bianca (per FireTrack)
for dir in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
    size="48"
    if [[ "$dir" == *"hdpi"* ]]; then size="72"; fi
    if [[ "$dir" == *"xhdpi"* ]]; then size="96"; fi
    if [[ "$dir" == *"xxhdpi"* ]]; then size="144"; fi
    if [[ "$dir" == *"xxxhdpi"* ]]; then size="192"; fi
    
    mkdir -p "$dir"
    convert -size "${size}x${size}" xc:red \
        -font Arial -pointsize $((size * 60 / 100)) \
        -fill white -gravity center -draw "text 0,0 'F'" \
        -strip "$dir/ic_launcher.png"
    cp "$dir/ic_launcher.png" "$dir/ic_launcher_round.png"
    echo "✅ Creato $dir/ic_launcher.png (${size}x${size})"
done

echo "🎉 Icone rigenerate!"
