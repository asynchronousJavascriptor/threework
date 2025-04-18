import * as THREE from 'three'
import vertexShader from './shaders/vertex.glsl'
import fragmentShader from './shaders/fragment.glsl'
import Lenis from 'lenis'

export default class WebGl {
    constructor() {
        this.container = document.body
        this.images = [...document.querySelectorAll('img')]
        this.planes = []
        this.clock = new THREE.Clock()

        const imageUrls = [...document.querySelectorAll('img')].map(img => img.src)

        this.preloadTextures(imageUrls).then((textures) => {
            this.loadedTextures = textures // ✅ store the preloaded textures
            document.getElementById('loader').style.display = 'none'

            this.initRenderer()
            this.initCamera()
            this.initScene()
            this.initScroll()
            this.createPlanes()
            this.addEvents()
            this.animate()
        })
    }

    preloadTextures(imageUrls) {
        return new Promise((resolve, reject) => {
            const manager = new THREE.LoadingManager()
            const loader = new THREE.TextureLoader(manager)

            const textures = {}

            manager.onLoad = () => {
                console.log('✅ All textures loaded.')
                resolve(textures)
            }

            manager.onError = url => {
                console.error('❌ Failed to load:', url)
                reject(new Error(`Failed to load ${url}`))
            }

            imageUrls.forEach(url => {
                loader.load(url, tex => {
                    textures[url] = tex
                })
            })
        })
    }

    initRenderer() {
        this.canvas = document.createElement('canvas')
        this.canvas.classList.add('webgl')
        this.container.appendChild(this.canvas)

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true
        })

        this.renderer.setPixelRatio(window.devicePixelRatio)
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    getScreenToWorldScale(z = this.camera.position.z) {
        const fovInRadians = (this.camera.fov * Math.PI) / 180
        const height = 2 * Math.tan(fovInRadians / 2) * z
        const width = height * this.camera.aspect
        return { width, height }
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        )
        this.camera.position.z = 2
    }

    initScene() {
        this.scene = new THREE.Scene()
    }

    initScroll() {
        this.lenis = new Lenis()
        this.lastScroll = 0
        this.scrollSpeed = 0
        this.scrollDirection = 1 // 1 = down, -1 = up

        this.lenis.on('scroll', ({ scroll }) => {
            const delta = scroll - this.lastScroll

            // Save direction
            this.scrollDirection = Math.sign(delta)

            // Save scroll speed (absolute)
            this.scrollSpeed = Math.abs(delta) * 0.01

            this.lastScroll = scroll


            this.updatePlanes()
        })
    }

    createMaterial(texture, dispTexture) {
        return new THREE.ShaderMaterial({
            uniforms: {
                u_image: { value: texture },
                u_disp: { value: dispTexture },
                u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
                u_time: { value: 0 },
                u_intensity: { value: 0 },
                u_scrollSpeed: { value: 0 }, // optional
                u_scrollDirection: { value: this.scrollDirection }
            },
            vertexShader,
            fragmentShader,
            transparent: true
        })
    }

    createPlanes() {
        const loader = new THREE.TextureLoader()

        this.images.forEach(img => {
            const texture = this.loadedTextures[img.src] // ✅ use preloaded texture
            const dispTexture = loader.load('./disp4.webp') // fine as-is

            const geometry = new THREE.PlaneGeometry(1, 1, 50, 50)
            const material = this.createMaterial(texture, dispTexture)

            const mesh = new THREE.Mesh(geometry, material)
            mesh.userData.isHovered = false

            this.scene.add(mesh)
            img.style.opacity = 0

            img.addEventListener('mouseenter', () => mesh.userData.isHovered = true)
            img.addEventListener('mouseleave', () => mesh.userData.isHovered = false)

            this.planes.push({ img, mesh })
        })
    }

    getLenisScrollY() {
        const transform = this.lenis?.target?.style.transform
        if (!transform) return 0
        const match = transform.match(/-?[\d.]+/g)
        return match ? parseFloat(match[1]) : 0
    }

    updatePlanes() {
        const { width: worldWidth, height: worldHeight } = this.getScreenToWorldScale()
        const scrollY = this.getLenisScrollY()

        this.planes.forEach(({ img, mesh }) => {
            const rect = img.getBoundingClientRect()

            const meshWidth = (rect.width / window.innerWidth) * worldWidth
            const meshHeight = (rect.height / window.innerHeight) * worldHeight
            mesh.scale.set(meshWidth, meshHeight, 1)

            const x = (rect.left + rect.width / 2) / window.innerWidth * 2 - 1
            const yPosInPage = rect.top + scrollY + rect.height / 2
            const y = -(yPosInPage / window.innerHeight) * 2 + 1

            const worldX = x * (worldWidth / 2)
            const worldY = y * (worldHeight / 2)


            mesh.position.set(worldX, worldY, 0)
        })
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    animate = (time) => {
        this.lenis.raf(time)
        this.updatePlanes()
        this.renderer.render(this.scene, this.camera)

        const elapsed = this.clock.getElapsedTime()

        this.planes.forEach(({ mesh }) => {
            const uniforms = mesh.material.uniforms
            if (uniforms.u_time) uniforms.u_time.value = elapsed
            if (uniforms.u_intensity) uniforms.u_intensity.value *= 0.95
            if (uniforms.u_scrollSpeed) {
                uniforms.u_scrollSpeed.value *= 0.56
                uniforms.u_scrollSpeed.value += this.scrollSpeed
            }
            uniforms.u_scrollDirection.value = this.scrollDirection
        })

        requestAnimationFrame(this.animate)
    }

    addEvents() {
        window.addEventListener('resize', () => {
            this.resize()
            this.updatePlanes();
        })

        window.addEventListener('mousemove', (e) => {
            const mouseX = e.clientX
            const mouseY = e.clientY

            this.planes.forEach(({ mesh, img }) => {
                if (!mesh.userData.isHovered) return

                const rect = img.getBoundingClientRect()

                const x = (mouseX - rect.left) / rect.width
                const y = 1.0 - (mouseY - rect.top) / rect.height // flip Y for shader

                // Clamp values between 0 and 1
                const uvX = Math.min(Math.max(x, 0), 1)
                const uvY = Math.min(Math.max(y, 0), 1)

                mesh.material.uniforms.u_mouse.value.set(uvX, uvY)
                mesh.material.uniforms.u_intensity.value = 1.0
            })
        })
    }
}