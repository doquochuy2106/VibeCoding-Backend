import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductDto } from './dto/find-product.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

export function toSlug(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateUniqueSlug(
    baseSlug: string,
    currentId?: number,
  ): Promise<string> {
    let slug = baseSlug || `san-pham-${Date.now()}`;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.product.findUnique({
        where: { slug },
      });

      if (!existing || (currentId && existing.id === currentId)) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async create(createProductDto: CreateProductDto) {
    const { name, slug: customSlug, price, quantity, isActive, description, imageUrl } =
      createProductDto;

    let finalSlug: string;
    if (customSlug && customSlug.trim()) {
      const formattedSlug = toSlug(customSlug.trim());
      const existing = await this.prisma.product.findUnique({
        where: { slug: formattedSlug },
      });
      if (existing) {
        throw new BadRequestException(`Slug '${formattedSlug}' đã tồn tại`);
      }
      finalSlug = formattedSlug;
    } else {
      const baseSlug = toSlug(name);
      finalSlug = await this.generateUniqueSlug(baseSlug);
    }

    const product = await this.prisma.product.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        description: description?.trim() || null,
        price: new Prisma.Decimal(price),
        imageUrl: imageUrl?.trim() || null,
        quantity: quantity !== undefined ? Number(quantity) : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return product;
  }

  async findAll(query?: FindProductDto) {
    let page = 1;
    let limit = 10;
    let search: string | undefined;
    let name: string | undefined;
    let isActiveParam: string | undefined;
    let minPrice: number | undefined;
    let maxPrice: number | undefined;
    let sortBy: string | undefined;
    let sortOrder: 'asc' | 'desc' = 'desc';

    if (query) {
      page = query.page && query.page > 0 ? Number(query.page) : 1;
      limit = query.limit && query.limit > 0 ? Number(query.limit) : 10;
      search = query.search;
      name = query.name;
      isActiveParam = query.isActive;
      minPrice = query.minPrice;
      maxPrice = query.maxPrice;
      sortBy = query.sortBy || query.sort || query.orderBy;
      const order = query.sortOrder || query.order;
      if (order && ['asc', 'desc'].includes(order.toLowerCase())) {
        sortOrder = order.toLowerCase() as 'asc' | 'desc';
      }
    }

    const skip = (page - 1) * limit;
    const andConditions: Prisma.ProductWhereInput[] = [];

    // Search keyword theo name, slug, description
    if (search && search.trim()) {
      const keyword = search.trim();
      andConditions.push({
        OR: [
          { name: { contains: keyword } },
          { slug: { contains: keyword } },
          { description: { contains: keyword } },
        ],
      });
    }

    // Lọc riêng theo name
    if (name && name.trim()) {
      andConditions.push({
        name: { contains: name.trim() },
      });
    }

    // Lọc theo trạng thái kinh doanh: isActive
    if (
      isActiveParam !== undefined &&
      isActiveParam !== 'all' &&
      isActiveParam !== ''
    ) {
      const isActiveBool =
        isActiveParam === 'true' ||
        isActiveParam === '1' ||
        (isActiveParam as unknown) === true;
      andConditions.push({ isActive: isActiveBool });
    }

    // Lọc theo khoảng giá
    if (minPrice !== undefined && minPrice >= 0) {
      andConditions.push({ price: { gte: new Prisma.Decimal(minPrice) } });
    }
    if (maxPrice !== undefined && maxPrice >= 0) {
      andConditions.push({ price: { lte: new Prisma.Decimal(maxPrice) } });
    }

    const where: Prisma.ProductWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    // Sắp xếp
    const sortFieldMapping: Record<
      string,
      keyof Prisma.ProductOrderByWithRelationInput
    > = {
      id: 'id',
      ID: 'id',
      name: 'name',
      slug: 'slug',
      price: 'price',
      quantity: 'quantity',
      stock: 'quantity',
      isActive: 'isActive',
      status: 'isActive',
      createdAt: 'createdAt',
      created_at: 'createdAt',
      created: 'createdAt',
      updatedAt: 'updatedAt',
      updated_at: 'updatedAt',
    };

    let targetSortField: keyof Prisma.ProductOrderByWithRelationInput =
      'createdAt';
    let targetDirection: Prisma.SortOrder = sortOrder;

    if (sortBy && sortBy.trim()) {
      let rawField = sortBy.trim();
      if (rawField.includes(',') || rawField.includes(':')) {
        const [fieldPart, dirPart] = rawField.split(/[,:]/);
        rawField = fieldPart.trim();
        if (dirPart && ['asc', 'desc'].includes(dirPart.trim().toLowerCase())) {
          targetDirection = dirPart.trim().toLowerCase() as Prisma.SortOrder;
        }
      }

      if (sortFieldMapping[rawField]) {
        targetSortField = sortFieldMapping[rawField];
      } else if (sortFieldMapping[rawField.toLowerCase()]) {
        targetSortField = sortFieldMapping[rawField.toLowerCase()];
      }
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      { [targetSortField]: targetDirection },
    ];
    if (targetSortField !== 'id') {
      orderBy.push({ id: 'desc' });
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      meta: {
        page,
        total,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data,
    };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id ${id}`);
    }

    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id ${id}`);
    }

    let finalSlug = existing.slug;
    if (updateProductDto.slug !== undefined) {
      const cleanSlug = toSlug(updateProductDto.slug.trim());
      if (cleanSlug && cleanSlug !== existing.slug) {
        const slugExists = await this.prisma.product.findUnique({
          where: { slug: cleanSlug },
        });
        if (slugExists && slugExists.id !== id) {
          throw new BadRequestException(
            `Slug '${cleanSlug}' đã được sử dụng bởi sản phẩm khác`,
          );
        }
        finalSlug = cleanSlug;
      }
    }

    const data: Prisma.ProductUpdateInput = {};

    if (updateProductDto.name !== undefined) {
      data.name = updateProductDto.name.trim();
    }
    if (updateProductDto.slug !== undefined) {
      data.slug = finalSlug;
    }
    if (updateProductDto.description !== undefined) {
      data.description = updateProductDto.description?.trim() || null;
    }
    if (updateProductDto.price !== undefined) {
      data.price = new Prisma.Decimal(updateProductDto.price);
    }
    if (updateProductDto.imageUrl !== undefined) {
      data.imageUrl = updateProductDto.imageUrl?.trim() || null;
    }
    if (updateProductDto.quantity !== undefined) {
      data.quantity = Number(updateProductDto.quantity);
    }
    if (updateProductDto.isActive !== undefined) {
      data.isActive = Boolean(updateProductDto.isActive);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data,
    });

    return updated;
  }

  async remove(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orderItems: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id ${id}`);
    }

    if (product._count.orderItems > 0) {
      throw new BadRequestException(
        'Không thể xóa sản phẩm đã tồn tại trong đơn hàng. Vui lòng chuyển trạng thái sang Tạm ẩn (Ngừng kinh doanh) thay vì xóa.',
      );
    }

    await this.prisma.product.delete({
      where: { id },
    });

    return {
      message: 'Xóa sản phẩm thành công',
      id,
    };
  }
}
