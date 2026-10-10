import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { toSlug } from 'src/products/products.service';
import { UploadService } from 'src/upload/upload.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { FindCategoryDto } from './dto/find-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  private async generateUniqueSlug(
    baseSlug: string,
    currentId?: number,
  ): Promise<string> {
    const normalizedBase = baseSlug || `danh-muc-${Date.now()}`;
    let slug = normalizedBase;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.category.findUnique({
        where: { slug },
      });

      if (!existing || (currentId && existing.id === currentId)) {
        return slug;
      }

      slug = `${normalizedBase}-${counter}`;
      counter++;
    }
  }

  async create(createCategoryDto: CreateCategoryDto) {
    const { name, slug: customSlug, description, imageUrl } = createCategoryDto;

    let finalSlug: string;
    if (customSlug && customSlug.trim()) {
      const formattedSlug = toSlug(customSlug.trim());
      if (!formattedSlug) {
        throw new BadRequestException('Slug không hợp lệ');
      }
      const existing = await this.prisma.category.findUnique({
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

    return this.prisma.category.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        description: description?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  async findAll(query?: FindCategoryDto) {
    let page = 1;
    let limit = 10;
    let search: string | undefined;
    let name: string | undefined;
    let sortBy: string | undefined;
    let sortOrder: 'asc' | 'desc' = 'desc';

    if (query) {
      page = query.page && query.page > 0 ? Number(query.page) : 1;
      limit = query.limit && query.limit > 0 ? Number(query.limit) : 10;
      search = query.search;
      name = query.name;
      sortBy = query.sortBy || query.sort || query.orderBy;
      const order = query.sortOrder || query.order;
      if (order && ['asc', 'desc'].includes(order.toLowerCase())) {
        sortOrder = order.toLowerCase() as 'asc' | 'desc';
      }
    }

    const skip = (page - 1) * limit;
    const andConditions: Prisma.CategoryWhereInput[] = [];

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

    if (name && name.trim()) {
      andConditions.push({
        name: { contains: name.trim() },
      });
    }

    const where: Prisma.CategoryWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const sortFieldMapping: Record<
      string,
      keyof Prisma.CategoryOrderByWithRelationInput
    > = {
      id: 'id',
      ID: 'id',
      name: 'name',
      slug: 'slug',
      createdAt: 'createdAt',
      created_at: 'createdAt',
      created: 'createdAt',
      updatedAt: 'updatedAt',
      updated_at: 'updatedAt',
    };

    let targetSortField: keyof Prisma.CategoryOrderByWithRelationInput =
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

    const orderBy: Prisma.CategoryOrderByWithRelationInput[] = [
      { [targetSortField]: targetDirection },
    ];
    if (targetSortField !== 'id') {
      orderBy.push({ id: 'desc' });
    }

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
      this.prisma.category.count({ where }),
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
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        products: true,
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục với id ${id}`);
    }

    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Không tìm thấy danh mục với id ${id}`);
    }

    let finalSlug = existing.slug;
    if (updateCategoryDto.slug !== undefined) {
      const cleanSlug = toSlug(updateCategoryDto.slug.trim());
      if (cleanSlug && cleanSlug !== existing.slug) {
        const slugExists = await this.prisma.category.findUnique({
          where: { slug: cleanSlug },
        });
        if (slugExists && slugExists.id !== id) {
          throw new BadRequestException(
            `Slug '${cleanSlug}' đã được sử dụng bởi danh mục khác`,
          );
        }
        finalSlug = cleanSlug;
      }
    }

    const data: Prisma.CategoryUpdateInput = {};

    if (updateCategoryDto.name !== undefined) {
      data.name = updateCategoryDto.name.trim();
    }
    if (updateCategoryDto.slug !== undefined) {
      data.slug = finalSlug;
    }
    if (updateCategoryDto.description !== undefined) {
      data.description = updateCategoryDto.description?.trim() || null;
    }
    if (updateCategoryDto.imageUrl !== undefined) {
      const nextImageUrl = updateCategoryDto.imageUrl?.trim() || null;
      if (existing.imageUrl && existing.imageUrl !== nextImageUrl) {
        this.uploadService.deleteFile(existing.imageUrl);
      }
      data.imageUrl = nextImageUrl;
    }

    return this.prisma.category.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  async remove(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục với id ${id}`);
    }

    await this.prisma.category.delete({
      where: { id },
    });

    if (category.imageUrl) {
      this.uploadService.deleteFile(category.imageUrl);
    }

    return {
      message: 'Xóa danh mục thành công',
      id,
    };
  }
}
