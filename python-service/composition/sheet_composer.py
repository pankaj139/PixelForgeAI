"""
Sheet composition functionality for creating A4 layouts with images
"""

import os
import time
import logging
from typing import List, Tuple, Optional
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.units import inch, mm
from reportlab.lib.utils import ImageReader
import io

from models import SheetCompositionRequest, ComposedSheet, GridLayout, SheetOrientation, OutputFormat

logger = logging.getLogger(__name__)

class SheetComposer:
    """
    Handles sheet composition functionality including A4 layout generation,
    image arrangement, and PDF creation.
    """
    
    # A4 dimensions in pixels at 300 DPI
    A4_WIDTH_PX = 2480  # 8.27 inches * 300 DPI
    A4_HEIGHT_PX = 3508  # 11.69 inches * 300 DPI
    
    # A4 dimensions in points for ReportLab (72 DPI)
    A4_WIDTH_PT = 595.27
    A4_HEIGHT_PT = 841.89
    
    # Margins in pixels (300 DPI) - approximately 0.5 inch margins
    MARGIN_PX = 150  # 0.5 inch * 300 DPI
    
    # Margins in points for PDF
    MARGIN_PT = 36  # 0.5 inch * 72 DPI
    
    def __init__(self, temp_dir: str = "/tmp/sheet_composition"):
        """
        Initialize the sheet composer
        
        Args:
            temp_dir: Directory for temporary files
        """
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        
    def process_sheet_composition_request(self, request: SheetCompositionRequest) -> ComposedSheet:
        """
        Process a sheet composition request
        
        Args:
            request: SheetCompositionRequest with images and layout parameters
            
        Returns:
            ComposedSheet with composition results
            
        Raises:
            FileNotFoundError: If any image file is not found
            ValueError: If invalid parameters are provided
            Exception: If composition fails
        """
        start_time = time.time()
        
        try:
            logger.info(f"Starting sheet composition with {len(request.processed_images)} images")
            
            # Validate request
            self._validate_composition_request(request)
            
            # Load and validate images
            images = self._load_images(request.processed_images)
            
            # Calculate grid dimensions and cell size
            sheet_width, sheet_height = self._get_sheet_dimensions(request.sheet_orientation)
            cell_width, cell_height = self._calculate_cell_dimensions(
                sheet_width, sheet_height, request.grid_layout
            )
            
            # Arrange images in grid
            arranged_images = self._arrange_images_in_grid(
                images, request.grid_layout, cell_width, cell_height
            )
            
            # Generate output path if not provided
            output_path = request.output_path
            if not output_path:
                timestamp = int(time.time())
                extension = "pdf" if request.output_format == OutputFormat.PDF else "jpg"
                output_path = str(self.temp_dir / f"composed_sheet_{timestamp}.{extension}")
            
            # Create the composed sheet
            if request.output_format == OutputFormat.PDF:
                final_output_path = self._create_pdf_sheet(
                    arranged_images, request.grid_layout, request.sheet_orientation, output_path
                )
            else:
                final_output_path = self._create_image_sheet(
                    arranged_images, sheet_width, sheet_height, output_path
                )
            
            processing_time = time.time() - start_time
            
            result = ComposedSheet(
                output_path=final_output_path,
                grid_layout=request.grid_layout,
                images_used=request.processed_images,
                sheet_dimensions={"width": sheet_width, "height": sheet_height},
                processing_time=processing_time
            )
            
            logger.info(f"Sheet composition completed in {processing_time:.3f}s. Output: {final_output_path}")
            return result
            
        except Exception as e:
            logger.error(f"Sheet composition failed: {e}")
            raise
    
    def _validate_composition_request(self, request: SheetCompositionRequest) -> None:
        """
        Validate the composition request parameters
        
        Args:
            request: SheetCompositionRequest to validate
            
        Raises:
            ValueError: If validation fails
        """
        if not request.processed_images:
            raise ValueError("At least one image must be provided")
        
        max_images = request.grid_layout.rows * request.grid_layout.columns
        if len(request.processed_images) > max_images:
            raise ValueError(f"Too many images for grid layout. Maximum: {max_images}, provided: {len(request.processed_images)}")
        
        # Validate grid layout
        if request.grid_layout.rows < 1 or request.grid_layout.columns < 1:
            raise ValueError("Grid layout must have at least 1 row and 1 column")
        
        if request.grid_layout.rows > 10 or request.grid_layout.columns > 10:
            raise ValueError("Grid layout cannot exceed 10 rows or 10 columns")
    
    def _load_images(self, image_paths: List[str]) -> List[Image.Image]:
        """
        Load and validate all images
        
        Args:
            image_paths: List of paths to image files
            
        Returns:
            List of loaded PIL Images
            
        Raises:
            FileNotFoundError: If any image file is not found
            ValueError: If any image cannot be loaded
        """
        images = []
        
        for image_path in image_paths:
            if not os.path.exists(image_path):
                raise FileNotFoundError(f"Image file not found: {image_path}")
            
            try:
                image = Image.open(image_path)
                # Convert to RGB if necessary
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                images.append(image)
                logger.debug(f"Loaded image: {image_path} ({image.width}x{image.height})")
            except Exception as e:
                raise ValueError(f"Failed to load image {image_path}: {e}")
        
        return images
    
    def _get_sheet_dimensions(self, orientation: SheetOrientation) -> Tuple[int, int]:
        """
        Get sheet dimensions based on orientation
        
        Args:
            orientation: Sheet orientation (portrait or landscape)
            
        Returns:
            Tuple of (width, height) in pixels
        """
        if orientation == SheetOrientation.PORTRAIT:
            return self.A4_WIDTH_PX, self.A4_HEIGHT_PX
        else:  # LANDSCAPE
            return self.A4_HEIGHT_PX, self.A4_WIDTH_PX
    
    def _calculate_cell_dimensions(self, sheet_width: int, sheet_height: int, 
                                 grid_layout: GridLayout) -> Tuple[int, int]:
        """
        Calculate the dimensions of each grid cell
        
        Args:
            sheet_width: Total sheet width in pixels
            sheet_height: Total sheet height in pixels
            grid_layout: Grid layout configuration
            
        Returns:
            Tuple of (cell_width, cell_height) in pixels
        """
        # Account for margins
        usable_width = sheet_width - (2 * self.MARGIN_PX)
        usable_height = sheet_height - (2 * self.MARGIN_PX)
        
        # Calculate cell dimensions
        cell_width = usable_width // grid_layout.columns
        cell_height = usable_height // grid_layout.rows
        
        logger.debug(f"Cell dimensions: {cell_width}x{cell_height} for {grid_layout.rows}x{grid_layout.columns} grid")
        
        return cell_width, cell_height
    
    def _arrange_images_in_grid(self, images: List[Image.Image], grid_layout: GridLayout,
                              cell_width: int, cell_height: int) -> List[Tuple[Image.Image, int, int]]:
        """
        Arrange images in the grid layout
        
        Args:
            images: List of PIL Images
            grid_layout: Grid layout configuration
            cell_width: Width of each grid cell
            cell_height: Height of each grid cell
            
        Returns:
            List of tuples (image, x_position, y_position)
        """
        arranged_images = []
        
        for i, image in enumerate(images):
            # Calculate grid position
            row = i // grid_layout.columns
            col = i % grid_layout.columns
            
            # Break if we exceed the grid
            if row >= grid_layout.rows:
                logger.warning(f"Image {i} exceeds grid capacity, skipping")
                break
            
            # Resize image to fit cell while maintaining aspect ratio
            resized_image = self._resize_image_to_fit(image, cell_width, cell_height)
            
            # Calculate position (centered in cell)
            x_pos = self.MARGIN_PX + (col * cell_width) + (cell_width - resized_image.width) // 2
            y_pos = self.MARGIN_PX + (row * cell_height) + (cell_height - resized_image.height) // 2
            
            arranged_images.append((resized_image, x_pos, y_pos))
            logger.debug(f"Arranged image {i} at position ({x_pos}, {y_pos})")
        
        return arranged_images
    
    def _resize_image_to_fit(self, image: Image.Image, max_width: int, max_height: int) -> Image.Image:
        """
        Resize image to fit within the specified dimensions while maintaining aspect ratio
        
        Args:
            image: PIL Image to resize
            max_width: Maximum width
            max_height: Maximum height
            
        Returns:
            Resized PIL Image
        """
        # Add some padding within the cell
        padding = 20
        target_width = max_width - (2 * padding)
        target_height = max_height - (2 * padding)
        
        # Calculate scaling factor
        width_ratio = target_width / image.width
        height_ratio = target_height / image.height
        scale_factor = min(width_ratio, height_ratio)
        
        # Calculate new dimensions
        new_width = int(image.width * scale_factor)
        new_height = int(image.height * scale_factor)
        
        # Resize image
        resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        logger.debug(f"Resized image from {image.width}x{image.height} to {new_width}x{new_height}")
        
        return resized_image
    
    def _create_image_sheet(self, arranged_images: List[Tuple[Image.Image, int, int]],
                          sheet_width: int, sheet_height: int, output_path: str) -> str:
        """
        Create a composed sheet as an image file
        
        Args:
            arranged_images: List of (image, x_pos, y_pos) tuples
            sheet_width: Sheet width in pixels
            sheet_height: Sheet height in pixels
            output_path: Path for output file
            
        Returns:
            Path to the created image file
        """
        # Create blank sheet
        sheet = Image.new('RGB', (sheet_width, sheet_height), 'white')
        
        # Paste images onto sheet
        for image, x_pos, y_pos in arranged_images:
            sheet.paste(image, (x_pos, y_pos))
        
        # Save the composed sheet
        sheet.save(output_path, 'JPEG', quality=95)
        
        logger.info(f"Created image sheet: {output_path}")
        return output_path
    
    def _create_pdf_sheet(self, arranged_images: List[Tuple[Image.Image, int, int]],
                         grid_layout: GridLayout, orientation: SheetOrientation, 
                         output_path: str) -> str:
        """
        Create a composed sheet as a PDF file
        
        Args:
            arranged_images: List of (image, x_pos, y_pos) tuples
            grid_layout: Grid layout configuration
            orientation: Sheet orientation
            output_path: Path for output PDF file
            
        Returns:
            Path to the created PDF file
        """
        # Set up PDF canvas
        if orientation == SheetOrientation.PORTRAIT:
            page_size = A4
        else:
            page_size = (A4[1], A4[0])  # Landscape
        
        c = canvas.Canvas(output_path, pagesize=page_size)
        page_width, page_height = page_size
        
        # Calculate cell dimensions in points
        usable_width = page_width - (2 * self.MARGIN_PT)
        usable_height = page_height - (2 * self.MARGIN_PT)
        cell_width_pt = usable_width / grid_layout.columns
        cell_height_pt = usable_height / grid_layout.rows
        
        # Add images to PDF
        for i, (image, _, _) in enumerate(arranged_images):
            # Calculate grid position
            row = i // grid_layout.columns
            col = i % grid_layout.columns
            
            # Calculate position in PDF coordinates (bottom-left origin)
            x_pos_pt = self.MARGIN_PT + (col * cell_width_pt)
            y_pos_pt = page_height - self.MARGIN_PT - ((row + 1) * cell_height_pt)
            
            # Resize image to fit cell
            max_width_pt = cell_width_pt - 20  # Add padding
            max_height_pt = cell_height_pt - 20
            
            # Calculate image dimensions in points
            image_width_pt, image_height_pt = self._calculate_pdf_image_size(
                image, max_width_pt, max_height_pt
            )
            
            # Center image in cell
            x_centered = x_pos_pt + (cell_width_pt - image_width_pt) / 2
            y_centered = y_pos_pt + (cell_height_pt - image_height_pt) / 2
            
            # Convert PIL image to ImageReader for ReportLab
            img_buffer = io.BytesIO()
            image.save(img_buffer, format='JPEG', quality=95)
            img_buffer.seek(0)
            img_reader = ImageReader(img_buffer)
            
            # Draw image on PDF
            c.drawImage(img_reader, x_centered, y_centered, 
                       width=image_width_pt, height=image_height_pt)
            
            logger.debug(f"Added image {i} to PDF at ({x_centered:.1f}, {y_centered:.1f})")
        
        # Save PDF
        c.save()
        
        logger.info(f"Created PDF sheet: {output_path}")
        return output_path
    
    def _calculate_pdf_image_size(self, image: Image.Image, max_width_pt: float, 
                                max_height_pt: float) -> Tuple[float, float]:
        """
        Calculate image size in points for PDF while maintaining aspect ratio
        
        Args:
            image: PIL Image
            max_width_pt: Maximum width in points
            max_height_pt: Maximum height in points
            
        Returns:
            Tuple of (width_pt, height_pt)
        """
        # Convert pixel dimensions to points (assuming 300 DPI for images)
        image_width_pt = (image.width * 72) / 300
        image_height_pt = (image.height * 72) / 300
        
        # Calculate scaling factor
        width_ratio = max_width_pt / image_width_pt
        height_ratio = max_height_pt / image_height_pt
        scale_factor = min(width_ratio, height_ratio)
        
        # Calculate final dimensions
        final_width_pt = image_width_pt * scale_factor
        final_height_pt = image_height_pt * scale_factor
        
        return final_width_pt, final_height_pt
    
    def get_supported_grid_layouts(self) -> List[GridLayout]:
        """
        Get list of supported grid layouts
        
        Returns:
            List of supported GridLayout configurations
        """
        return [
            GridLayout(rows=1, columns=2),  # 1x2
            GridLayout(rows=1, columns=3),  # 1x3
            GridLayout(rows=2, columns=2),  # 2x2
            GridLayout(rows=2, columns=3),  # 2x3
            GridLayout(rows=3, columns=2),  # 3x2
            GridLayout(rows=3, columns=3),  # 3x3
        ]
    
    def validate_grid_layout(self, grid_layout: GridLayout) -> bool:
        """
        Validate if a grid layout is supported
        
        Args:
            grid_layout: GridLayout to validate
            
        Returns:
            True if supported, False otherwise
        """
        supported_layouts = self.get_supported_grid_layouts()
        return any(
            layout.rows == grid_layout.rows and layout.columns == grid_layout.columns
            for layout in supported_layouts
        )