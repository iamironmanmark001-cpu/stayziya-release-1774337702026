// Preloader Logic with Session State
const preloader = document.getElementById('preloader');
if (preloader) {
    const navEntries = performance.getEntriesByType("navigation");
    const isReload = navEntries.length > 0 && navEntries[0].type === "reload";
    
    if (sessionStorage.getItem('preloaderShown') && !isReload) {
        // Skip preloader on normal internal navigation
        preloader.style.display = 'none';
        preloader.remove();
    } else {
        // Show preloader
        sessionStorage.setItem('preloaderShown', 'true');
        window.addEventListener('load', () => {
            setTimeout(() => {
                preloader.classList.add('hidden');
                setTimeout(() => preloader.remove(), 1000); 
            }, 3200); 
        });
    }
}

const revealElements = document.querySelectorAll('.reveal, .service-card, .section-title, .room-card, .masonry-item, .upload-zone, .amenity-item, .glass-zolo');

// Initial state
revealElements.forEach(el => el.classList.add('reveal'));

// Custom Cursor Logic
const cursorDot = document.querySelector('[data-cursor-dot]');
const cursorOutline = document.querySelector('[data-cursor-outline]');
if (cursorDot && cursorOutline) {
    window.addEventListener('mousemove', function(e) {
        const posX = e.clientX;
        const posY = e.clientY;
        
        cursorDot.style.left = `${posX}px`;
        cursorDot.style.top = `${posY}px`;
        
        cursorOutline.animate({
            left: `${posX}px`,
            top: `${posY}px`
        }, { duration: 500, fill: "forwards" });
    });
}

// DYNAMIC BUBBLES
function createBubbles() {
    const container = document.createElement('div');
    container.className = 'bubble-container';
    document.body.appendChild(container);

    const colors = ['#fbbf24', '#000000']; // Gold and Black

    // Layer 1: Normal Background Bubbles
    for (let i = 0; i < 20; i++) {
        createBubble(container, colors, false);
    }

    // Layer 2: Close Darker Bubbles (Larger, more opaque)
    for (let i = 0; i < 8; i++) {
        createBubble(container, ['#000000'], true);
    }
}

function createBubble(container, colors, isClose) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    const sizeBase = isClose ? 80 : 20;
    const sizeVar = isClose ? 60 : 40;
    const size = Math.random() * sizeVar + sizeBase + 'px';
    
    bubble.style.width = size;
    bubble.style.height = size;
    bubble.style.left = Math.random() * 100 + 'vw';
    bubble.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Close bubbles are less blurry and more opaque
    if (isClose) {
        bubble.style.opacity = '0.25';
        bubble.style.filter = 'blur(1px)';
        bubble.style.zIndex = '1'; 
    }

    const duration = Math.random() * (isClose ? 5 : 8) + (isClose ? 5 : 7) + 's';
    bubble.style.setProperty('--duration', duration);
    
    const drift = (Math.random() - 0.5) * (isClose ? 300 : 150) + 'px';
    bubble.style.setProperty('--drift', drift);
    
    bubble.style.animationDelay = Math.random() * 10 + 's';
    container.appendChild(bubble);
}
createBubbles();

const revealOptions = {
    threshold: 0.15,
    rootMargin: "0px 0px -50px 0px"
};

const revealObserver = new IntersectionObserver(function(entries, observer) {
    entries.forEach(entry => {
        if (!entry.isIntersecting) {
            return;
        }
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
    });
}, revealOptions);

revealElements.forEach(el => revealObserver.observe(el));


// File Upload Simulation
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-upload');
const masonryGrid = document.getElementById('masonry-grid');

// Click to upload
uploadZone.addEventListener('click', () => fileInput.click());

// Drag and drop styles
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    uploadZone.addEventListener(eventName, () => uploadZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, () => uploadZone.classList.remove('dragover'), false);
});

// Handle drop
uploadZone.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    let dt = e.dataTransfer;
    let files = dt.files;
    handleFiles(files);
}

// Handle file input
fileInput.addEventListener('change', function() {
    handleFiles(this.files);
});

function handleFiles(files) {
    ([...files]).forEach(uploadFile);
}

function uploadFile(file) {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = function() {
        const item = document.createElement('div');
        item.className = 'masonry-item reveal active';
        
        // Randomize height slightly to mimic masonry
        if(Math.random() > 0.5) item.style.height = '400px';

        item.innerHTML = `
            <img src="${reader.result}" alt="Uploaded image">
            <div class="img-overlay">
                <button class="btn-download" onclick="downloadImage('${reader.result}', '${file.name}')"><i class="fas fa-download"></i> HQ</button>
            </div>
        `;
        masonryGrid.prepend(item);
    }
}

// Handle Download functionality
document.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', function() {
        // Find the image in to that item
        const img = this.closest('.masonry-item').querySelector('img');
        downloadImage(img.src, 'stayziya-elite-photo.jpg');
    });
});

function downloadImage(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
// --- AUTO-SLIDESHOW FOR ROOM CARDS ---
async function initRoomSlideshows() {
    const cards = document.querySelectorAll('.zolo-room-card');
    for (const card of cards) {
        const propId = card.dataset.propertyId;
        if (!propId) continue;

        try {
            const res = await fetch(`/api/properties/${propId}`);
            if (!res.ok) continue;
            const data = await res.json();
            const photos = data.photos || [];
            
            if (photos.length > 0) {
                const container = card.querySelector('.slideshow-container');
                // Clear existing initial slide if we have dynamic ones
                container.innerHTML = '';
                
                photos.forEach((p, index) => {
                    const slide = document.createElement('div');
                    slide.className = `slide ${index === 0 ? 'active' : ''}`;
                    slide.style.backgroundImage = `url('${p.image_url}')`;

                    if (p.description) {
                        const caption = document.createElement('div');
                        caption.className = 'slide-caption';
                        caption.innerText = p.description;
                        slide.appendChild(caption);
                    }

                    container.appendChild(slide);
                });

                if (photos.length > 1) {
                    startSlideshow(container);
                }
            }
        } catch (err) {
            console.error('Failed to load slideshow for', propId, err);
        }
    }
}

function startSlideshow(container) {
    let currentSlide = 0;
    const slides = container.querySelectorAll('.slide');
    
    setInterval(() => {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }, 4000); // Slide every 4 seconds
}

// Initialize slideshows if we are on the home page (or any page with room cards)
if (document.querySelector('.zolo-room-card')) {
    initRoomSlideshows();
}

// --- SITE-WIDE IMAGE CACHE BUSTING ---
// If we are on experience or blog page, ensure images are fresh
function refreshSiteImages() {
    const images = document.querySelectorAll('img[src*="experience-"], img[src*="hero-bg"], #ownerPhoto, .owner-img img');
    images.forEach(img => {
        const src = img.src.split('?')[0];
        img.src = src + '?' + Date.now();
    });
}
if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
    // refreshSiteImages(); // Uncomment if needed, but usually server cache headers or direct upload refresh is enough
}

// --- GLOBAL SECURE AUTO-LOGOUT ---
// Automatically destroy any active Admin sessions if the user navigates back to any public page.
if (window.location.pathname !== '/admin.html') {
    fetch('/api/logout', { method: 'POST' }).catch(() => {});
}
