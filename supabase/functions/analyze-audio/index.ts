import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Enhanced DTW implementation with better normalization for pitch comparison
function enhancedDTW(seq1: number[], seq2: number[]): number {
  const maxLength = 150;
  const s1 = seq1.slice(0, maxLength);
  const s2 = seq2.slice(0, maxLength);
  
  const m = s1.length;
  const n = s2.length;
  
  if (m === 0 || n === 0) return 1.0;
  
  // Normalize sequences to reduce impact of octave differences
  const normalizeSequence = (seq: number[]) => {
    return seq.map(f => f > 0 ? Math.log2(f / 220) : 0); // Normalize to A3 (220Hz)
  };
  
  const norm_s1 = normalizeSequence(s1);
  const norm_s2 = normalizeSequence(s2);
  
  // Dynamic programming with memory optimization
  let prevRow = new Array(n + 1).fill(Infinity);
  let currRow = new Array(n + 1).fill(Infinity);
  
  prevRow[0] = 0;
  
  for (let i = 1; i <= m; i++) {
    currRow[0] = Infinity;
    for (let j = 1; j <= n; j++) {
      // Enhanced cost function for pitch comparison
      let cost = 0;
      if (norm_s1[i - 1] === 0 && norm_s2[j - 1] === 0) {
        cost = 0; // Both silent
      } else if (norm_s1[i - 1] === 0 || norm_s2[j - 1] === 0) {
        cost = 2; // One silent, one voiced
      } else {
        cost = Math.abs(norm_s1[i - 1] - norm_s2[j - 1]); // Pitch difference
      }
      
      currRow[j] = cost + Math.min(
        prevRow[j] + 1,        // insertion penalty
        currRow[j - 1] + 1,    // deletion penalty
        prevRow[j - 1]         // match/substitution
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }
  
  // Better normalization - convert to similarity score
  const maxPossibleDistance = Math.max(m, n) * 2;
  const normalizedDistance = Math.min(1, prevRow[n] / maxPossibleDistance);
  return normalizedDistance;
}

// Enhanced Web Audio API-based pitch extraction with FFT analysis
function extractPitch(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = 4096; // Larger FFT window for better frequency resolution
  const hopSize = Math.floor(windowSize / 8); // 12.5% overlap for better temporal resolution
  const pitches: number[] = [];
  
  // Calculate target number of points based on audio duration
  const audioDuration = audioBuffer.length / sampleRate;
  const targetPoints = Math.min(200, Math.floor(audioDuration * 20)); // 20 points per second, max 200
  const actualHopSize = Math.floor((audioBuffer.length - windowSize) / targetPoints);
  
  console.log(`Enhanced pitch extraction: duration=${audioDuration}s, targetPoints=${targetPoints}, hopSize=${actualHopSize}`);
  
  for (let i = 0; i < audioBuffer.length - windowSize; i += actualHopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Apply Hamming window for better spectral analysis
    for (let j = 0; j < windowSize; j++) {
      window[j] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * j / (windowSize - 1));
    }
    
    // Calculate RMS energy for voice activity detection
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += window[j] * window[j];
    }
    energy = Math.sqrt(energy / windowSize);
    
    let bestFreq = 0;
    
    // Enhanced voice activity detection with adaptive threshold
    if (energy > 0.001) {
      console.log(`Processing window ${Math.floor(i/actualHopSize)}: energy=${energy.toFixed(4)}`);
      
      // FFT-based spectral analysis for better pitch detection
      const spectrum = performFFT(window);
      const magnitudes = spectrum.map(complex => Math.sqrt(complex.real * complex.real + complex.imag * complex.imag));
      
      // Find fundamental frequency using harmonic product spectrum
      bestFreq = findFundamentalFrequency(magnitudes, sampleRate);
      
      // Fallback to autocorrelation if FFT doesn't find clear pitch
      if (bestFreq === 0) {
        bestFreq = autocorrelationPitch(window, sampleRate);
      }
      
      if (bestFreq > 0) {
        console.log(`Found pitch: ${bestFreq.toFixed(1)}Hz via enhanced analysis`);
      } else {
        console.log(`No clear pitch found in window ${Math.floor(i/actualHopSize)}`);
      }
    } else {
      console.log(`Low energy window ${Math.floor(i/actualHopSize)}: energy=${energy.toFixed(6)}`);
    }
    
    pitches.push(Math.round(bestFreq));
    
    if (pitches.length >= targetPoints) break;
  }
  
  console.log(`Extracted ${pitches.length} pitch points. Non-zero: ${pitches.filter(p => p > 0).length}`);
  return pitches;
}

// Enhanced FFT implementation for spectral analysis
function performFFT(signal: Float32Array): Array<{real: number, imag: number}> {
  const N = signal.length;
  const spectrum = new Array(N);
  
  // Initialize complex spectrum
  for (let i = 0; i < N; i++) {
    spectrum[i] = { real: signal[i], imag: 0 };
  }
  
  // Cooley-Tukey FFT algorithm (simplified for power-of-2 sizes)
  for (let size = 2; size <= N; size *= 2) {
    const halfSize = size / 2;
    const step = N / size;
    
    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const u = spectrum[i + j];
        const t = {
          real: spectrum[i + j + halfSize].real * Math.cos(-2 * Math.PI * j / size) - 
                spectrum[i + j + halfSize].imag * Math.sin(-2 * Math.PI * j / size),
          imag: spectrum[i + j + halfSize].real * Math.sin(-2 * Math.PI * j / size) + 
                spectrum[i + j + halfSize].imag * Math.cos(-2 * Math.PI * j / size)
        };
        
        spectrum[i + j] = { real: u.real + t.real, imag: u.imag + t.imag };
        spectrum[i + j + halfSize] = { real: u.real - t.real, imag: u.imag - t.imag };
      }
    }
  }
  
  return spectrum;
}

// Harmonic Product Spectrum for fundamental frequency detection
function findFundamentalFrequency(magnitudes: number[], sampleRate: number): number {
  const minFreq = 80;
  const maxFreq = 500;
  const minBin = Math.floor(minFreq * magnitudes.length / sampleRate);
  const maxBin = Math.floor(maxFreq * magnitudes.length / sampleRate);
  
  // Create harmonic product spectrum
  const hps = new Array(maxBin + 1).fill(0);
  
  for (let bin = minBin; bin <= maxBin; bin++) {
    let product = magnitudes[bin];
    
    // Multiply harmonics (2f, 3f, 4f)
    for (let harmonic = 2; harmonic <= 4; harmonic++) {
      const harmonicBin = bin * harmonic;
      if (harmonicBin < magnitudes.length) {
        product *= magnitudes[harmonicBin];
      }
    }
    
    hps[bin] = product;
  }
  
  // Find peak in HPS
  let maxValue = 0;
  let peakBin = 0;
  
  for (let bin = minBin; bin <= maxBin; bin++) {
    if (hps[bin] > maxValue) {
      maxValue = hps[bin];
      peakBin = bin;
    }
  }
  
  // Convert bin to frequency
  const freq = peakBin * sampleRate / magnitudes.length;
  
  // Validate frequency is in reasonable range with sufficient magnitude
  if (freq >= minFreq && freq <= maxFreq && maxValue > 0.01) {
    return freq;
  }
  
  return 0;
}

// Enhanced autocorrelation with better normalization
function autocorrelationPitch(window: Float32Array, sampleRate: number): number {
  const minPitch = 80;
  const maxPitch = 500;
  const minPeriod = Math.floor(sampleRate / maxPitch);
  const maxPeriod = Math.floor(sampleRate / minPitch);
  
  let maxCorr = 0;
  let bestFreq = 0;
  
  for (let period = minPeriod; period <= maxPeriod; period++) {
    let correlation = 0;
    let norm1 = 0, norm2 = 0;
    
    for (let j = 0; j < window.length - period; j++) {
      correlation += window[j] * window[j + period];
      norm1 += window[j] * window[j];
      norm2 += window[j + period] * window[j + period];
    }
    
    // Normalized correlation coefficient
    const normalizedCorr = correlation / Math.sqrt(norm1 * norm2);
    
    if (normalizedCorr > maxCorr) {
      maxCorr = normalizedCorr;
      bestFreq = sampleRate / period;
    }
  }
  
  // Higher threshold for autocorrelation since it's normalized
  return maxCorr > 0.3 ? bestFreq : 0;
}

// Fast onset detection
function detectOnsets(audioBuffer: Float32Array, sampleRate: number): number[] {
  const windowSize = Math.floor(sampleRate * 0.100); // 100ms windows  
  const hopSize = Math.floor(windowSize / 2);
  const onsets: number[] = [];
  const maxOnsets = 20; // Limit number of onsets
  
  let prevEnergy = 0;
  
  for (let i = 0; i < audioBuffer.length - windowSize && onsets.length < maxOnsets; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    const energy = window.reduce((sum, sample, idx) => 
      idx % 4 === 0 ? sum + sample * sample : sum, 0) / (windowSize / 4); // Subsample
    
    if (energy > prevEnergy * 2.0 && energy > 0.02) {
      onsets.push(i / sampleRate);
    }
    
    prevEnergy = energy;
  }
  
  return onsets;
}

// Enhanced spectral feature extraction with Web Audio API concepts
function extractAdvancedFeatures(audioBuffer: Float32Array, sampleRate: number): number[][] {
  const windowSize = Math.floor(sampleRate * 0.100); // 100ms windows
  const hopSize = Math.floor(windowSize / 2);
  const features: number[][] = [];
  const maxFrames = 40; // Increased frames for better analysis
  
  for (let i = 0; i < audioBuffer.length - windowSize && features.length < maxFrames; i += hopSize) {
    const window = audioBuffer.slice(i, i + windowSize);
    
    // Apply Hamming window
    for (let j = 0; j < windowSize; j++) {
      window[j] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * j / (windowSize - 1));
    }
    
    // Enhanced spectral features
    const feature = [];
    
    // 1. RMS Energy (better than simple energy)
    const rmsEnergy = Math.sqrt(window.reduce((sum, s) => sum + s * s, 0) / window.length);
    feature.push(rmsEnergy);
    
    // 2. Zero Crossing Rate
    let zcr = 0;
    for (let j = 1; j < window.length; j++) {
      if ((window[j] >= 0) !== (window[j-1] >= 0)) zcr++;
    }
    feature.push(zcr / window.length);
    
    // 3. Enhanced Spectral Centroid via FFT
    const spectrum = performFFT(window);
    const magnitudes = spectrum.slice(0, Math.floor(spectrum.length / 2))
      .map(complex => Math.sqrt(complex.real * complex.real + complex.imag * complex.imag));
    
    let spectralCentroid = 0;
    let totalMagnitude = 0;
    for (let k = 0; k < magnitudes.length; k++) {
      const freq = k * sampleRate / (2 * magnitudes.length);
      spectralCentroid += freq * magnitudes[k];
      totalMagnitude += magnitudes[k];
    }
    feature.push(totalMagnitude > 0 ? spectralCentroid / totalMagnitude : 0);
    
    // 4. Spectral Rolloff (frequency below which 85% of energy lies)
    const cumulativeEnergy = new Array(magnitudes.length);
    cumulativeEnergy[0] = magnitudes[0] * magnitudes[0];
    for (let k = 1; k < magnitudes.length; k++) {
      cumulativeEnergy[k] = cumulativeEnergy[k-1] + magnitudes[k] * magnitudes[k];
    }
    const totalEnergy = cumulativeEnergy[cumulativeEnergy.length - 1];
    const rolloffThreshold = 0.85 * totalEnergy;
    let rolloffBin = magnitudes.length - 1;
    for (let k = 0; k < cumulativeEnergy.length; k++) {
      if (cumulativeEnergy[k] >= rolloffThreshold) {
        rolloffBin = k;
        break;
      }
    }
    feature.push(rolloffBin * sampleRate / (2 * magnitudes.length));
    
    // 5. Spectral Flux (measure of how quickly the spectrum is changing)
    if (features.length > 0) {
      const prevMagnitudes = features[features.length - 1].slice(5, 5 + Math.min(50, magnitudes.length));
      let flux = 0;
      for (let k = 0; k < Math.min(prevMagnitudes.length, magnitudes.length); k++) {
        const diff = magnitudes[k] - prevMagnitudes[k];
        flux += diff * diff;
      }
      feature.push(Math.sqrt(flux));
    } else {
      feature.push(0);
    }
    
    // Store first 50 magnitude bins for next frame's flux calculation
    feature.push(...magnitudes.slice(0, Math.min(50, magnitudes.length)));
    
    features.push(feature);
  }
  
  return features;
}

// Simple emotion detection
function detectSadness(features: number[][]): number {
  if (features.length === 0) return 0;
  
  let sadnessScore = 0;
  
  for (const feature of features) {
    const energy = feature[0] || 0;
    const zcr = feature[1] || 0;
    const centroid = feature[2] || 0;
    
    // Simple heuristic: low energy, low zcr suggest sadness
    const frameScore = Math.max(0, (1 - energy) * (1 - zcr) * (1 - centroid));
    sadnessScore += frameScore;
  }
  
  return Math.min(1, sadnessScore / features.length);
}

// Fast audio buffer decoding
function decodeAudioBuffer(base64: string): Float32Array {
  try {
    const binaryString = atob(base64);
    const maxSamples = 44100 * 10; // Limit to 10 seconds of audio
    const sampleCount = Math.min(binaryString.length / 2, maxSamples); // Assume 16-bit samples
    
    const float32Array = new Float32Array(sampleCount);
    
    for (let i = 0; i < sampleCount; i++) {
      const byteIndex = i * 2;
      if (byteIndex + 1 < binaryString.length) {
        // Simple 16-bit conversion
        const sample = (binaryString.charCodeAt(byteIndex) & 0xFF) | 
                      ((binaryString.charCodeAt(byteIndex + 1) & 0xFF) << 8);
        // Convert to signed and normalize
        const signed = sample > 32767 ? sample - 65536 : sample;
        float32Array[i] = signed / 32768.0;
      }
    }
    
    return float32Array;
  } catch (error) {
    console.error('Audio decode error:', error);
    return new Float32Array(0);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { noviceAudio, professionalAudio } = await req.json()
    
    if (!noviceAudio || !professionalAudio) {
      throw new Error('Both audio files are required')
    }

    console.log('Starting audio analysis...')
    
    const sampleRate = 22050; // Lower sample rate for faster processing
    
    // Decode audio buffers with error handling
    console.log('Decoding audio buffers...')
    const noviceBuffer = decodeAudioBuffer(noviceAudio);
    const professionalBuffer = decodeAudioBuffer(professionalAudio);
    
    if (noviceBuffer.length === 0 || professionalBuffer.length === 0) {
      throw new Error('Failed to decode audio buffers');
    }
    
    console.log(`Audio decoded: Novice ${noviceBuffer.length} samples, Professional ${professionalBuffer.length} samples`)

    // Extract features with time limits
    console.log('Extracting features...')
    const novicePitch = extractPitch(noviceBuffer, sampleRate);
    const professionalPitch = extractPitch(professionalBuffer, sampleRate);
    
    const noviceOnsets = detectOnsets(noviceBuffer, sampleRate);
    const professionalOnsets = detectOnsets(professionalBuffer, sampleRate);
    
    const noviceFeatures = extractAdvancedFeatures(noviceBuffer, sampleRate);
    const professionalFeatures = extractAdvancedFeatures(professionalBuffer, sampleRate);
    
    console.log('Features extracted successfully')

    // Calculate metrics quickly
    console.log('Calculating metrics...')
    
    // 1. Enhanced Pitch Accuracy using improved DTW with logarithmic normalization
    const dtwDistance = enhancedDTW(novicePitch, professionalPitch);
    const pitchAccuracy = Math.max(0, 1 - dtwDistance);
    console.log(`DTW distance: ${dtwDistance.toFixed(3)}, Pitch accuracy: ${(pitchAccuracy * 100).toFixed(1)}%`);
    
    // 2. Rhythm Timing Error
    const rhythmError = noviceOnsets.length > 0 && professionalOnsets.length > 0 
      ? Math.abs(noviceOnsets.length - professionalOnsets.length) / Math.max(noviceOnsets.length, professionalOnsets.length)
      : 0;
    
    // 3. Enhanced Feature similarity using advanced spectral features
    let featureSimilarity = 0;
    if (noviceFeatures.length > 0 && professionalFeatures.length > 0) {
      const minLength = Math.min(noviceFeatures.length, professionalFeatures.length);
      let totalDiff = 0;
      let featureCount = 0;
      
      for (let i = 0; i < minLength; i++) {
        // Compare first 5 main spectral features (RMS, ZCR, Centroid, Rolloff, Flux)
        for (let j = 0; j < Math.min(5, noviceFeatures[i].length, professionalFeatures[i].length); j++) {
          const noviceVal = noviceFeatures[i][j] || 0;
          const professionalVal = professionalFeatures[i][j] || 0;
          
          // Normalize differences by feature type
          let normalizedDiff = 0;
          if (j === 0) { // RMS Energy
            normalizedDiff = Math.abs(noviceVal - professionalVal) / Math.max(noviceVal + professionalVal, 0.001);
          } else if (j === 1) { // ZCR
            normalizedDiff = Math.abs(noviceVal - professionalVal);
          } else { // Spectral features (centroid, rolloff, flux)
            normalizedDiff = Math.abs(noviceVal - professionalVal) / Math.max(Math.max(noviceVal, professionalVal), 1000);
          }
          
          totalDiff += normalizedDiff;
          featureCount++;
        }
      }
      
      featureSimilarity = featureCount > 0 ? Math.max(0, 1 - (totalDiff / featureCount)) : 0;
      console.log(`Feature similarity: ${(featureSimilarity * 100).toFixed(1)}% (compared ${featureCount} features)`);
    }
    
    // 4. Emotion Match
    const noviceSadness = detectSadness(noviceFeatures);
    const professionalSadness = detectSadness(professionalFeatures);
    const emotionMatch = 1 - Math.abs(noviceSadness - professionalSadness);
    
    console.log('Analysis complete')
    console.log('Novice pitch data:', novicePitch)
    console.log('Professional pitch data:', professionalPitch)

    const results = {
      pitchAccuracy: {
        novice: Math.max(0, Math.min(1, pitchAccuracy)),
        professional: 1.0,
        difference: Math.abs(1.0 - Math.max(0, Math.min(1, pitchAccuracy)))
      },
      rhythmTiming: {
        novice: Math.max(0, Math.min(1, 1 - rhythmError)),
        professional: 1.0,
        difference: Math.abs(1.0 - Math.max(0, Math.min(1, 1 - rhythmError)))
      },
      mfccDistance: {
        novice: Math.max(0, Math.min(1, featureSimilarity)),
        professional: 1.0,
        difference: Math.abs(1.0 - Math.max(0, Math.min(1, featureSimilarity)))
      },
      emotionMatch: {
        novice: Math.max(0, Math.min(1, emotionMatch)),
        professional: Math.max(0, Math.min(1, professionalSadness)),
        difference: Math.abs(Math.max(0, Math.min(1, professionalSadness)) - Math.max(0, Math.min(1, emotionMatch)))
      },
      // Add raw pitch data for visualization
      pitchData: {
        novice: novicePitch,
        professional: professionalPitch,
        sampleRate: sampleRate
      }
    };

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Audio analysis error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})