import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Coins, Trophy, Play, RotateCcw, ArrowRight, Zap, Check, X, Star } from 'lucide-react';
import { QDB, Question } from './types.ts';

// --- Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 450;
const GRAVITY = 0.5;
const JUMP_FORCE = -10;
const PLAYER_SPEED = 3.5;
const GROUND_Y = CANVAS_HEIGHT - 50;
const LEVEL_LENGTH = 5000;

// --- Types ---
type GameState = 'START' | 'PLAYING' | 'QUESTION' | 'LEVEL_COMPLETE' | 'GAME_OVER';

interface Entity {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'BLOCK' | 'PIPE' | 'COIN' | 'ENEMY' | 'FLAG' | 'GROUND' | 'PLATFORM';
  collected?: boolean;
  questionIndex?: number;
  color?: string;
  moving?: boolean;
  dir?: number;
  vy?: number;
  isProtectionBlock?: boolean;
}

interface Feedback {
  id: number;
  text: string;
  x: number;
  y: number;
  opacity: number;
}

interface HighScore {
  name: string;
  score: number;
  date: string;
}

// --- App Component ---
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [coins, setCoins] = useState(0);
  const [combo, setCombo] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionBlockIndex, setQuestionBlockIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [showLifeBonus, setShowLifeBonus] = useState(false);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const lastLifeAwardedAt = useRef(0);
  const feedbackIdCounter = useRef(0);

  // Extra Life every 500 points
  useEffect(() => {
    const threshold = 500;
    const currentThresholdCount = Math.floor(score / threshold);
    if (currentThresholdCount > lastLifeAwardedAt.current && score > 0) {
      setLives(l => Math.min(l + 1, 5)); // Limit to 5 lives for balance
      lastLifeAwardedAt.current = currentThresholdCount;
      setShowLifeBonus(true);
      setTimeout(() => setShowLifeBonus(false), 2000);
    }
  }, [score]);

  // Load High Scores
  useEffect(() => {
    const saved = localStorage.getItem('turkce_mario_highscores');
    if (saved) {
      setHighScores(JSON.parse(saved));
    }
  }, []);

  const checkHighScore = useCallback((finalScore: number) => {
    const saved = localStorage.getItem('turkce_mario_highscores');
    const scores: HighScore[] = saved ? JSON.parse(saved) : [];
    
    // Check if score is in top 5
    const isTop5 = scores.length < 5 || finalScore > scores[scores.length - 1].score;
    
    if (isTop5 && finalScore > 0) {
      setIsNewHighScore(true);
    } else {
      setShowLeaderboard(true);
    }
  }, []);

  const saveHighScore = () => {
    if (!playerName.trim()) return;
    
    const newEntry: HighScore = {
      name: playerName.trim(),
      score: score,
      date: new Date().toISOString()
    };
    
    const updated = [...highScores, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
      
    setHighScores(updated);
    localStorage.setItem('turkce_mario_highscores', JSON.stringify(updated));
    setIsNewHighScore(false);
    setShowLeaderboard(true);
  };

  // Game Engine Refs
  const playerRef = useRef({ x: 50, y: GROUND_Y - 40, vx: 0, vy: 0, w: 32, h: 40, onGround: false, jumping: false });
  const entitiesRef = useRef<Entity[]>([]);
  const cameraXRef = useRef(0);
  const frameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const keysRef = useRef<Record<string, boolean>>({});

  // --- Level Generation ---
  const generateLevel = useCallback((lvl: number) => {
    const entities: Entity[] = [];
    
    // Shuffle questions for this level
    const levelQuestions = [...(QDB[lvl] || [])].sort(() => Math.random() - 0.5);
    setShuffledQuestions(levelQuestions);

    // Ground with Pits (Level 2+)
    if (lvl === 1) {
      entities.push({ x: 0, y: GROUND_Y, w: LEVEL_LENGTH, h: 50, type: 'GROUND', color: '#E75926' });
    } else {
      // Create segments of ground with gaps
      let currentX = 0;
      while (currentX < LEVEL_LENGTH) {
        const segmentW = 400 + Math.random() * 600;
        const gapW = 80 + Math.random() * 40; // 80 to 120 pixels gap
        
        entities.push({ x: currentX, y: GROUND_Y, w: segmentW, h: 50, type: 'GROUND', color: '#E75926' });
        currentX += segmentW + gapW;
      }
    }

    // Pipes (Obstacles)
    const pipePositions: number[] = [];
    for (let i = 0; i < 8; i++) {
      const px = 800 + i * 600 + Math.random() * 200;
      // Ensure pipe is on ground
      const onGround = entities.some(e => e.type === 'GROUND' && px >= e.x && px + 50 <= e.x + e.w);
      if (onGround || lvl === 1) {
        pipePositions.push(px);
        entities.push({
          x: px,
          y: GROUND_Y - 60,
          w: 50,
          h: 60,
          type: 'PIPE',
          color: '#00A800'
        });
      }
    }

    // Questions (10 per level) - Avoid pipes and gaps
    for (let i = 0; i < 10; i++) {
      const isProtection = i === 4; // 5th block is red protection block
      let qx = 400 + i * 450;
      
      // Ensure qx is not too close to any pipe and is over ground
      let attempts = 0;
      while (attempts < 10 && (pipePositions.some(px => Math.abs(qx - px) < 100) || !entities.some(e => e.type === 'GROUND' && qx >= e.x && qx + 40 <= e.x + e.w))) {
        qx += 50;
        attempts++;
      }

      entities.push({
        x: qx,
        y: GROUND_Y - 130,
        w: 40,
        h: 40,
        type: 'BLOCK',
        questionIndex: i,
        color: isProtection ? '#FF0000' : '#FFD700',
        isProtectionBlock: isProtection
      });
    }

    // Platforms and Coins (Aligned in rows)
    for (let i = 0; i < 15; i++) {
      const platX = 600 + i * 300;
      const platY = GROUND_Y - 100 - (i % 2) * 60;
      const platW = 100;
      
      // Add platform
      entities.push({
        x: platX,
        y: platY,
        w: platW,
        h: 20,
        type: 'PLATFORM',
        color: '#8B4513'
      });

      // Add 3 coins in a row on the platform
      for (let j = 0; j < 3; j++) {
        entities.push({
          x: platX + 15 + j * 30,
          y: platY - 30,
          w: 20,
          h: 20,
          type: 'COIN',
          color: '#FFD700'
        });
      }
    }

    // Enemies - Ensure they are on ground and not inside pipes
    for (let i = 0; i < 10; i++) {
      let ex = 1000 + i * 500;
      
      // Ensure ex is not inside any pipe
      while (pipePositions.some(px => Math.abs(ex - px) < 60)) {
        ex += 50;
      }

      const ground = entities.find(e => e.type === 'GROUND' && ex >= e.x && ex + 30 <= e.x + e.w);
      
      if (ground || lvl === 1) {
        entities.push({
          x: ex,
          y: GROUND_Y - 30,
          w: 30,
          h: 30,
          type: 'ENEMY',
          color: '#A52A2A',
          moving: true,
          dir: -1,
          vy: 0
        });
      }
    }

    // Flag
    entities.push({ x: LEVEL_LENGTH - 200, y: GROUND_Y - 200, w: 20, h: 200, type: 'FLAG', color: '#FFFFFF' });

    entitiesRef.current = entities;
    playerRef.current = { x: 50, y: GROUND_Y - 150, vx: 0, vy: 0, w: 32, h: 40, onGround: false, jumping: false, invincibleUntil: 0 };
    cameraXRef.current = -100;
    setProgress(0);
  }, []);

  // --- Game Loop ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background (Sky)
    ctx.fillStyle = '#5C94FC';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Parallax Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 10; i++) {
      const cx = (i * 400 - cameraXRef.current * 0.2) % 2000;
      ctx.beginPath();
      ctx.arc(cx, 50 + (i % 3) * 30, 30, 0, Math.PI * 2);
      ctx.arc(cx + 20, 40 + (i % 3) * 30, 25, 0, Math.PI * 2);
      ctx.arc(cx - 20, 40 + (i % 3) * 30, 25, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(-cameraXRef.current, 0);

    // Entities
    entitiesRef.current.forEach(e => {
      if (e.collected) return;
      
      if (e.type === 'GROUND') {
        ctx.fillStyle = '#E75926';
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = '#000';
        ctx.fillRect(e.x, e.y, e.w, 2);
      } else if (e.type === 'BLOCK') {
        ctx.fillStyle = e.color || '#FFD700';
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('?', e.x + 15, e.y + 28);
      } else if (e.type === 'PIPE') {
        ctx.fillStyle = '#00A800';
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = '#007000';
        ctx.fillRect(e.x - 5, e.y, e.w + 10, 20);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(e.x, e.y, e.w, e.h);
        ctx.strokeRect(e.x - 5, e.y, e.w + 10, 20);
      } else if (e.type === 'COIN') {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
      } else if (e.type === 'ENEMY') {
        ctx.fillStyle = '#A52A2A';
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = '#FFF';
        ctx.fillRect(e.x + 5, e.y + 5, 5, 5);
        ctx.fillRect(e.x + 20, e.y + 5, 5, 5);
      } else if (e.type === 'FLAG') {
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(e.x, e.y, 5, e.h);
        ctx.fillStyle = '#F00';
        ctx.fillRect(e.x + 5, e.y, 40, 30);
      } else if (e.type === 'PLATFORM') {
        ctx.fillStyle = e.color || '#8B4513';
        ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(e.x, e.y, e.w, e.h);
      }
    });

    // Feedbacks
    feedbacks.forEach(f => {
      ctx.globalAlpha = f.opacity;
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    });

    // Player
    const p = playerRef.current;
    const isInvincible = performance.now() < (p.invincibleUntil || 0);
    const blink = Math.floor(performance.now() / 100) % 2 === 0;

    if (!isInvincible || blink) {
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(p.x - 2, p.y, p.w + 4, 10);
      ctx.fillStyle = '#FFDBAC';
      ctx.fillRect(p.x + 10, p.y + 10, 22, 15);
      ctx.fillStyle = '#000';
      ctx.fillRect(p.x + 25, p.y + 12, 4, 4);
      ctx.fillStyle = '#0000FF';
      ctx.fillRect(p.x, p.y + 25, p.w, 15);
      
      // Protection indicator
      if (isInvincible && (p.invincibleUntil || 0) - performance.now() > 2000) {
        ctx.fillStyle = '#00FFFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('KORUMA!', p.x + p.w/2, p.y - 10);
        ctx.textAlign = 'left';
      }
    }

    ctx.restore();
  }, []);

  const update = useCallback((time: number) => {
    if (gameState !== 'PLAYING') return;

    if (!lastTimeRef.current) {
      lastTimeRef.current = time;
      frameIdRef.current = requestAnimationFrame(update);
      return;
    }

    const dt = Math.min(2, (time - lastTimeRef.current) / 16.67);
    lastTimeRef.current = time;

    const player = playerRef.current;
    const entities = entitiesRef.current;

    // Movement
    player.vx = PLAYER_SPEED;
    if (keysRef.current['Space'] || keysRef.current['ArrowUp']) {
      if (player.onGround) {
        player.vy = JUMP_FORCE;
        player.onGround = false;
        player.jumping = true;
      }
    }

    // Physics
    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Camera
    cameraXRef.current = player.x - 150;

    // Collision Detection
    player.onGround = false;
    entities.forEach((e, idx) => {
      if (e.collected) return;

      if (e.type === 'ENEMY' && e.moving) {
        // Enemy Gravity
        e.vy = (e.vy || 0) + GRAVITY * dt;
        e.y += e.vy * dt;

        // Enemy Ground Collision
        entities.forEach(other => {
          if (other.type === 'GROUND' && 
              e.x + e.w > other.x && e.x < other.x + other.w &&
              e.y + e.h >= other.y && e.y + e.h <= other.y + 15 && e.vy >= 0) {
            e.y = other.y - e.h;
            e.vy = 0;
          }
        });

        if (e.y > CANVAS_HEIGHT) {
          e.collected = true;
          return;
        }

        e.x += (e.dir || -1) * 1.5 * dt;
        
        // Turn around at pipes, other enemies, or level boundaries
        const nextX = e.x + (e.dir || -1) * 5;
        const hitObstacle = entities.some((other, oIdx) => 
          idx !== oIdx && !other.collected &&
          (other.type === 'PIPE' || other.type === 'ENEMY' || other.type === 'BLOCK') && 
          nextX < other.x + other.w && 
          nextX + e.w > other.x && 
          e.y < other.y + other.h && 
          e.y + e.h > other.y
        );
        
        if (hitObstacle || e.x < 0 || e.x > LEVEL_LENGTH) {
          e.dir = (e.dir || -1) * -1;
        }
      }

      // Use a slightly smaller hitbox for damage/solid objects to be more forgiving
      const padding = (e.type === 'COIN' || e.type === 'FLAG') ? 0 : 5;
      const isColliding = 
        player.x + padding < e.x + e.w &&
        player.x + player.w - padding > e.x &&
        player.y + padding < e.y + e.h &&
        player.y + player.h - padding > e.y;

      if (isColliding) {
        if (e.type === 'GROUND') {
          if (player.vy >= 0 && player.y + player.h >= e.y && player.y + player.h - player.vy * dt <= e.y + 15) {
            player.y = e.y - player.h;
            player.vy = 0;
            player.onGround = true;
            player.jumping = false;
          }
        } else if (e.type === 'PIPE' || e.type === 'BLOCK' || e.type === 'PLATFORM') {
          // Determine collision side with a small epsilon to prevent jitter
          const overlapX = Math.min(player.x + player.w - e.x, e.x + e.w - player.x);
          const overlapY = Math.min(player.y + player.h - e.y, e.y + e.h - player.y);

          if (overlapX < overlapY) {
            // Horizontal collision (Side)
            if (player.x + player.w/2 < e.x + e.w/2) {
              player.x = e.x - player.w - 0.1; // Small offset to prevent sticking
            } else {
              player.x = e.x + e.w + 0.1;
            }
            player.vx = 0; // Stop horizontal movement on impact
          } else {
            // Vertical collision (Top or Bottom)
            if (player.y + player.h/2 < e.y + e.h/2) {
              // Landing on top
              if (player.vy >= 0) {
                player.y = e.y - player.h;
                player.vy = 0;
                player.onGround = true;
                player.jumping = false;
              }
            } else {
              // Hitting head from bottom
              if (player.vy <= 0) {
                player.y = e.y + e.h;
                player.vy = 0.5; // Small bounce down
                if (e.type === 'BLOCK' && e.questionIndex !== undefined) {
                  handleQuestion(e.questionIndex, idx);
                }
              }
            }
          }
        } else if (e.type === 'COIN') {
          e.collected = true;
          setCoins(c => c + 1);
          setScore(s => s + 10);
        } else if (e.type === 'ENEMY') {
          if (player.vy > 0 && player.y + player.h <= e.y + 25) {
            e.collected = true;
            player.vy = -10;
            setScore(s => s + 50);
          } else {
            const isInvincible = performance.now() < (player.invincibleUntil || 0);
            if (!isInvincible) {
              handleDamage();
              player.invincibleUntil = performance.now() + 2000; // 2 seconds of invincibility
            }
          }
        } else if (e.type === 'FLAG') {
          handleLevelComplete();
        }
      }
    });

    if (player.y > CANVAS_HEIGHT) {
      handleDamage();
      player.invincibleUntil = performance.now() + 2000;
      
      // Find the next safe ground segment ahead
      const nextGround = entities.find(e => e.type === 'GROUND' && e.x > player.x);
      if (nextGround) {
        player.x = nextGround.x + 20; // Place slightly inside the segment
      } else {
        // Fallback if no ground ahead (e.g. at the very end)
        player.x -= 100;
      }
      
      player.y = GROUND_Y - 100;
      player.vy = 0;
    }

    setProgress(Math.min(100, (player.x / LEVEL_LENGTH) * 100));

    draw();
    frameIdRef.current = requestAnimationFrame(update);
  }, [gameState, level, draw]);

  // --- Handlers ---
  const handleDamage = () => {
    setLives(l => {
      if (l <= 1) {
        setGameState('GAME_OVER');
        checkHighScore(score);
        return 0;
      }
      return l - 1;
    });
    setCombo(0);
  };

  const handleQuestion = (qIdx: number, bIdx: number) => {
    const question = shuffledQuestions[qIdx];
    if (question) {
      setCurrentQuestion(question);
      setQuestionBlockIndex(bIdx);
      setGameState('QUESTION');
    }
  };

  const handleAnswer = (optionIdx: number) => {
    if (!currentQuestion) return;

    if (optionIdx === currentQuestion.a) {
      const points = 100;
      setScore(s => s + points);
      
      // Add feedback
      const player = playerRef.current;
      const newFeedback: Feedback = {
        id: ++feedbackIdCounter.current,
        text: `TEBRİKLER! +${points}`,
        x: player.x,
        y: player.y - 50,
        opacity: 1
      };
      setFeedbacks(f => [...f, newFeedback]);

      setCombo(c => {
        const newCombo = c + 1;
        if (newCombo % 3 === 0) setScore(s => s + 50);
        return newCombo;
      });

      if (questionBlockIndex !== null) {
        const block = entitiesRef.current[questionBlockIndex];
        block.collected = true;
        
        // Handle protection block
        if (block.isProtectionBlock) {
          playerRef.current.invincibleUntil = performance.now() + 10000; // 10 seconds
          setFeedbacks(f => [...f, {
            id: ++feedbackIdCounter.current,
            text: "KORUMA AKTİF! (10s)",
            x: player.x,
            y: player.y - 80,
            opacity: 1
          }]);
        }
      }
    } else {
      handleDamage();
      setCombo(0);
    }

    setGameState('PLAYING');
    setCurrentQuestion(null);
    setQuestionBlockIndex(null);
  };

  const handleLevelComplete = () => {
    if (level === 3) {
      setGameState('LEVEL_COMPLETE');
      checkHighScore(score);
    } else {
      setGameState('LEVEL_COMPLETE');
    }
  };

  const startGame = () => {
    // Reset all stats
    setScore(0);
    setLives(3);
    setCoins(0);
    setCombo(0);
    setLevel(1);
    setProgress(0);
    lastLifeAwardedAt.current = 0;
    setIsNewHighScore(false);
    setShowLeaderboard(false);
    setPlayerName('');
    setFeedbacks([]);
    
    // Reset player position - Start a bit higher to ensure ground catch
    playerRef.current = { 
      x: 50, 
      y: GROUND_Y - 150, 
      vx: 0, 
      vy: 0, 
      w: 32, 
      h: 40, 
      onGround: false, 
      jumping: false,
      invincibleUntil: 0
    };
    cameraXRef.current = -100; // Start with a bit of offset to see the beginning
    
    // Generate world
    generateLevel(1);
    
    // Start loop
    setGameState('PLAYING');
    lastTimeRef.current = 0;
  };

  const nextLevel = () => {
    const nextLvl = level + 1;
    if (nextLvl > 3) {
      setGameState('LEVEL_COMPLETE');
      return;
    }
    setLevel(nextLvl);
    generateLevel(nextLvl);
    setFeedbacks([]);
    setGameState('PLAYING');
  };

  const handleJump = () => {
    if (gameState === 'PLAYING') {
      keysRef.current['Space'] = true;
      setTimeout(() => keysRef.current['Space'] = false, 100);
    }
  };

  // Feedback cleanup
  useEffect(() => {
    if (feedbacks.length === 0) return;
    const timer = setInterval(() => {
      setFeedbacks(prev => prev
        .map(f => ({ ...f, y: f.y - 1, opacity: f.opacity - 0.02 }))
        .filter(f => f.opacity > 0)
      );
    }, 50);
    return () => clearInterval(timer);
  }, [feedbacks.length]);

  // --- Effects ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    if (gameState === 'PLAYING') {
      lastTimeRef.current = 0;
      frameIdRef.current = requestAnimationFrame(update);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
    };
  }, [gameState, update]);

  return (
    <div className="min-h-screen bg-[#000] flex items-center justify-center p-4 font-mono select-none">
      <div className="relative w-full max-w-[800px] aspect-[16/9] bg-[#5C94FC] overflow-hidden rounded-lg shadow-2xl border-4 border-[#333]">
        
        {/* Game Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full image-pixelated"
          onClick={handleJump}
        />

        {/* HUD Overlay */}
        {gameState !== 'START' && (
          <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)] pointer-events-none">
            <div className="flex flex-col gap-1">
              <div className="text-xl font-bold tracking-wider">MARIO TÜRKÇE</div>
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                <span>{score.toString().padStart(6, '0')}</span>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <div className="text-sm">BÖLÜM {level}</div>
              <div className="w-48 h-3 bg-black/40 border-2 border-white rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <AnimatePresence>
                {showLifeBonus && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.5 }}
                    className="absolute top-20 right-4 text-green-400 font-bold text-2xl drop-shadow-md"
                  >
                    +1 CAN! 🍄
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={i < lives ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Heart 
                      className={`w-6 h-6 ${i < lives ? 'text-red-500 fill-red-500' : 'text-gray-400 opacity-30'}`} 
                    />
                  </motion.div>
                ))}
              </div>
              {combo >= 3 && (
                <motion.div 
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="bg-orange-500 px-2 py-1 rounded text-xs flex items-center gap-1"
                >
                  <Zap className="w-3 h-3 fill-white" />
                  {combo} COMBO!
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Start Screen */}
        {gameState === 'START' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-8 text-center">
            <motion.h1 
              initial={{ y: -50 }} animate={{ y: 0 }}
              className="text-6xl font-black mb-4 text-yellow-400 drop-shadow-[4px_4px_0_rgba(255,0,0,1)]"
            >
              TÜRKÇE MARIO
            </motion.h1>
            <p className="text-lg mb-8 max-w-md">
              Zıpla, soru bloklarını vur ve Türkçe dilbilgisini eğlenerek öğren!
            </p>
            <div className="flex gap-4">
              <button 
                onClick={startGame}
                className="group relative bg-red-600 hover:bg-red-700 text-white px-12 py-4 rounded-xl text-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_8px_0_rgb(153,0,0)] hover:shadow-[0_4px_0_rgb(153,0,0)] hover:translate-y-1"
              >
                <div className="flex items-center gap-3">
                  <Play className="w-8 h-8 fill-white" />
                  OYUNA BAŞLA
                </div>
              </button>
              <button 
                onClick={() => setShowLeaderboard(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_8px_0_rgb(0,0,153)]"
              >
                <Trophy className="w-6 h-6" />
              </button>
            </div>

            {showLeaderboard && (
              <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-8 z-[60]">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="bg-blue-900/90 p-8 rounded-3xl shadow-2xl max-w-md w-full border-4 border-white/20"
                >
                  <h2 className="text-3xl font-black mb-6 text-yellow-400 flex items-center justify-center gap-3">
                    <Star className="fill-yellow-400" /> EN İYİLER <Star className="fill-yellow-400" />
                  </h2>
                  <div className="space-y-3 mb-8">
                    {highScores.map((hs, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/10">
                        <div className="flex items-center gap-4">
                          <span className="font-black text-xl w-6">{i + 1}.</span>
                          <span className="font-bold text-lg truncate max-w-[150px]">{hs.name}</span>
                        </div>
                        <span className="font-black text-xl">{hs.score}</span>
                      </div>
                    ))}
                    {highScores.length === 0 && <p className="opacity-50">Henüz rekor yok!</p>}
                  </div>
                  <button 
                    onClick={() => setShowLeaderboard(false)}
                    className="w-full bg-white text-blue-900 py-4 rounded-xl text-xl font-bold transition-all"
                  >
                    KAPAT
                  </button>
                </motion.div>
              </div>
            )}
            <div className="mt-12 grid grid-cols-3 gap-8 text-sm opacity-80">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 border-2 border-white rounded flex items-center justify-center">SPACE</div>
                <span>Zıpla</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 border-2 border-white rounded flex items-center justify-center">↑</div>
                <span>Zıpla</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 border-2 border-white rounded-full bg-red-500" />
                <span>Dokun</span>
              </div>
            </div>
          </div>
        )}

        {/* Question Modal */}
        <AnimatePresence>
          {gameState === 'QUESTION' && currentQuestion && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 z-50"
            >
              <div className="bg-white rounded-2xl p-8 w-full max-w-xl border-8 border-yellow-400 shadow-2xl">
                <div className="text-blue-600 font-bold mb-2 text-sm uppercase tracking-widest">SORU ZAMANI!</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-8 leading-tight">
                  {currentQuestion.q}
                </h2>
                <div className="grid gap-4">
                  {currentQuestion.o.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      className="group flex items-center justify-between bg-gray-100 hover:bg-blue-500 hover:text-white p-5 rounded-xl text-left font-bold text-xl transition-all border-b-4 border-gray-300 hover:border-blue-700 active:translate-y-1 active:border-b-0"
                    >
                      <div className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-full bg-white text-blue-600 flex items-center justify-center text-sm group-hover:bg-blue-200">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </div>
                      <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Level Complete Screen */}
        {gameState === 'LEVEL_COMPLETE' && (
          <div className="absolute inset-0 bg-green-600/95 flex flex-col items-center justify-center text-white p-8 text-center z-50 overflow-y-auto">
            {!isNewHighScore && !showLeaderboard && (
              <>
                <motion.div 
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center mb-6 shadow-xl"
                >
                  <Trophy className="w-12 h-12 text-green-700" />
                </motion.div>
                <h2 className="text-5xl font-black mb-2">HARİKA İŞ!</h2>
                <p className="text-xl mb-8">Bölüm {level} başarıyla tamamlandı.</p>
                
                <div className="bg-white/20 p-6 rounded-2xl mb-8 grid grid-cols-2 gap-8 min-w-[300px]">
                  <div>
                    <div className="text-sm opacity-80">PUAN</div>
                    <div className="text-3xl font-bold">{score}</div>
                  </div>
                  <div>
                    <div className="text-sm opacity-80">ALTIN</div>
                    <div className="text-3xl font-bold">{coins}</div>
                  </div>
                </div>

                <button 
                  onClick={level < 3 ? nextLevel : startGame}
                  className="bg-white text-green-700 px-12 py-4 rounded-xl text-2xl font-bold hover:bg-yellow-400 hover:text-black transition-all shadow-lg"
                >
                  {level < 3 ? 'SIRADAKİ BÖLÜM' : 'ANA MENÜ'}
                </button>
              </>
            )}

            {isNewHighScore && (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-white text-gray-800 p-8 rounded-3xl shadow-2xl max-w-md w-full border-8 border-yellow-400"
              >
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-3xl font-black mb-2 text-blue-600 uppercase">YENİ REKOR!</h2>
                <p className="mb-6 font-bold text-lg">En iyi 5 arasına girdin! İsmini yazar mısın?</p>
                <input 
                  type="text" 
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="İsminiz..."
                  maxLength={15}
                  className="w-full p-4 border-4 border-blue-200 rounded-xl mb-6 text-center text-2xl font-bold focus:border-blue-500 outline-none"
                  autoFocus
                />
                <button 
                  onClick={saveHighScore}
                  disabled={!playerName.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl text-xl font-bold transition-all disabled:opacity-50"
                >
                  KAYDET VE SIRALAMAYI GÖR
                </button>
              </motion.div>
            )}

            {showLeaderboard && (
              <motion.div 
                initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                className="bg-blue-900/80 p-8 rounded-3xl shadow-2xl max-w-md w-full border-4 border-white/20"
              >
                <h2 className="text-3xl font-black mb-6 text-yellow-400 flex items-center justify-center gap-3">
                  <Star className="fill-yellow-400" /> EN İYİLER <Star className="fill-yellow-400" />
                </h2>
                <div className="space-y-3 mb-8">
                  {highScores.map((hs, i) => (
                    <div 
                      key={i} 
                      className={`flex items-center justify-between p-3 rounded-xl ${hs.score === score && hs.name === playerName ? 'bg-yellow-400 text-blue-900' : 'bg-white/10'}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-black text-xl w-6">{i + 1}.</span>
                        <span className="font-bold text-lg truncate max-w-[150px]">{hs.name}</span>
                      </div>
                      <span className="font-black text-xl">{hs.score}</span>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={startGame}
                  className="w-full flex items-center justify-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl text-xl font-bold transition-all shadow-lg"
                >
                  <RotateCcw className="w-6 h-6" />
                  ANA MENÜYE DÖN
                </button>
              </motion.div>
            )}
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 bg-red-900/95 flex flex-col items-center justify-center text-white p-8 text-center z-50 overflow-y-auto">
            {!isNewHighScore && !showLeaderboard && (
              <>
                <h2 className="text-6xl font-black mb-4 text-red-500 drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">OYUN BİTTİ</h2>
                <p className="text-xl mb-12 opacity-80">Üzülme, tekrar deneyerek daha iyi yapabilirsin!</p>
                <div className="text-4xl font-bold mb-8">PUAN: {score}</div>
              </>
            )}

            {isNewHighScore && (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-white text-gray-800 p-8 rounded-3xl shadow-2xl max-w-md w-full border-8 border-yellow-400"
              >
                <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-3xl font-black mb-2 text-blue-600 uppercase">YENİ REKOR!</h2>
                <p className="mb-6 font-bold text-lg">En iyi 5 arasına girdin! İsmini yazar mısın?</p>
                <input 
                  type="text" 
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="İsminiz..."
                  maxLength={15}
                  className="w-full p-4 border-4 border-blue-200 rounded-xl mb-6 text-center text-2xl font-bold focus:border-blue-500 outline-none"
                  autoFocus
                />
                <button 
                  onClick={saveHighScore}
                  disabled={!playerName.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl text-xl font-bold transition-all disabled:opacity-50"
                >
                  KAYDET VE SIRALAMAYI GÖR
                </button>
              </motion.div>
            )}

            {showLeaderboard && (
              <motion.div 
                initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                className="bg-blue-900/80 p-8 rounded-3xl shadow-2xl max-w-md w-full border-4 border-white/20"
              >
                <h2 className="text-3xl font-black mb-6 text-yellow-400 flex items-center justify-center gap-3">
                  <Star className="fill-yellow-400" /> EN İYİLER <Star className="fill-yellow-400" />
                </h2>
                <div className="space-y-3 mb-8">
                  {highScores.map((hs, i) => (
                    <div 
                      key={i} 
                      className={`flex items-center justify-between p-3 rounded-xl ${hs.score === score && hs.name === playerName ? 'bg-yellow-400 text-blue-900' : 'bg-white/10'}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-black text-xl w-6">{i + 1}.</span>
                        <span className="font-bold text-lg truncate max-w-[150px]">{hs.name}</span>
                      </div>
                      <span className="font-black text-xl">{hs.score}</span>
                    </div>
                  ))}
                  {highScores.length === 0 && <p className="opacity-50">Henüz rekor yok!</p>}
                </div>
                <button 
                  onClick={startGame}
                  className="w-full flex items-center justify-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl text-xl font-bold transition-all shadow-lg"
                >
                  <RotateCcw className="w-6 h-6" />
                  TEKRAR DENE
                </button>
              </motion.div>
            )}

            {!isNewHighScore && !showLeaderboard && (
              <div className="flex gap-4">
                <button 
                  onClick={startGame}
                  className="flex items-center gap-3 bg-white text-red-900 px-8 py-4 rounded-xl text-xl font-bold hover:bg-yellow-400 transition-all shadow-lg"
                >
                  <RotateCcw className="w-6 h-6" />
                  TEKRAR DENE
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mobile Jump Button */}
        {gameState === 'PLAYING' && (
          <div className="absolute bottom-6 right-6 pointer-events-auto">
            <button
              onPointerDown={handleJump}
              className="w-24 h-24 bg-red-600/60 border-4 border-red-900/40 rounded-full flex items-center justify-center active:scale-90 active:bg-red-700 transition-all shadow-xl backdrop-blur-sm"
            >
              <div className="text-white font-black text-lg drop-shadow-md">ZIPLA</div>
            </button>
          </div>
        )}

      </div>

      {/* Footer Info */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs flex gap-6">
        <div className="flex items-center gap-1"><Check className="w-3 h-3" /> Doğru: +100 Puan</div>
        <div className="flex items-center gap-1"><X className="w-3 h-3" /> Yanlış: -1 Can</div>
        <div className="flex items-center gap-1"><Star className="w-3 h-3" /> 3 Combo: +50 Bonus</div>
      </div>

      <style>{`
        .image-pixelated {
          image-rendering: pixelated;
          image-rendering: crisp-edges;
        }
      `}</style>
    </div>
  );
}
